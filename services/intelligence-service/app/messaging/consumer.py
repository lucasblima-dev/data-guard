import json
import logging
from typing import Any
from uuid import UUID

import httpx
from aio_pika.abc import AbstractIncomingMessage
from pydantic import ValidationError

from app.config import settings
from app.database import async_session_factory
from app.messaging.broker import IntelligenceMessagingBroker
from app.messaging.events import (
    AnalysisCompletedPayload,
    AnalysisFailedPayload,
    EventEnvelope,
    QualityCompletedPayload,
    build_event,
)
from app.services.report_service import ReportService

logger = logging.getLogger(__name__)


class QualityProfileNotFoundError(LookupError):
    """Erro permanente quando o perfil de qualidade não existe para o analysis_id informado."""


def _extract_retry_count(message: AbstractIncomingMessage) -> int:
    raw = (message.headers or {}).get("x-retry-count", 0)
    try:
        return int(raw)
    except (TypeError, ValueError):
        return 0


def _try_extract_analysis_id(raw_body: bytes) -> UUID | None:
    try:
        data = json.loads(raw_body.decode("utf-8"))
        if not isinstance(data, dict):
            return None
        payload = data.get("payload")
        candidate = payload.get("analysis_id") if isinstance(payload, dict) else data.get("analysis_id")
        return UUID(str(candidate)) if candidate else None
    except Exception:
        return None


async def _safe_publish_failed(
    broker: IntelligenceMessagingBroker,
    analysis_id: UUID,
    correlation_id: UUID,
    error_code: str,
    error_message: str,
) -> None:
    try:
        failed_event = build_event(
            event_type="analysis.failed",
            correlation_id=correlation_id,
            payload=AnalysisFailedPayload(
                analysis_id=analysis_id,
                stage="intelligence",
                error_code=error_code,
                error_message=error_message,
            ),
        )
        await broker.publish_event(failed_event)
    except Exception as exc:
        logger.error(
            "Falha ao publicar evento analysis.failed para analysis_id=%s: %s",
            analysis_id,
            exc,
        )


async def _fetch_quality_details(analysis_id: UUID) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    url = f"{settings.DATA_QUALITY_SERVICE_URL.rstrip('/')}/internal/quality/{analysis_id}"
    async with httpx.AsyncClient(timeout=settings.INTERNAL_TIMEOUT_SECONDS) as client:
        response = await client.get(url)

    if response.status_code == 404:
        raise QualityProfileNotFoundError(
            f"Perfil de qualidade não encontrado para analysis_id={analysis_id}."
        )
    if response.status_code != 200:
        raise RuntimeError(
            f"data-quality-service retornou HTTP {response.status_code} ao consultar {analysis_id}."
        )

    data = response.json()
    profile = data.get("profile")
    if not isinstance(profile, dict):
        raise QualityProfileNotFoundError(
            f"Perfil de qualidade ausente na resposta para analysis_id={analysis_id}."
        )

    findings = data.get("findings") or []
    return profile, findings


async def handle_quality_completed(
    message: AbstractIncomingMessage,
    broker: IntelligenceMessagingBroker,
    report_service: ReportService,
) -> None:
    try:
        raw_data = json.loads(message.body.decode("utf-8"))
        envelope = EventEnvelope.model_validate(raw_data)
        payload = QualityCompletedPayload.model_validate(envelope.payload)
    except (UnicodeDecodeError, json.JSONDecodeError, ValidationError) as exc:
        fallback_analysis_id = _try_extract_analysis_id(message.body)
        if fallback_analysis_id is not None:
            await _safe_publish_failed(
                broker=broker,
                analysis_id=fallback_analysis_id,
                correlation_id=fallback_analysis_id,
                error_code="INVALID_EVENT_PAYLOAD",
                error_message="Payload inválido recebido pelo serviço de inteligência.",
            )
        logger.error(
            "[EVENT_DLQ] event_type=analysis.quality.completed event_id=%s analysis_id=%s reason=%s",
            message.message_id,
            fallback_analysis_id,
            f"INVALID_EVENT_PAYLOAD: {exc}",
        )
        await message.nack(requeue=False)
        return

    analysis_id = payload.analysis_id
    correlation_id = envelope.correlation_id

    logger.info(
        "[EVENT_RECEIVED] event_type=%s event_id=%s correlation_id=%s analysis_id=%s",
        envelope.event_type,
        envelope.event_id,
        correlation_id,
        analysis_id,
    )

    try:
        async with async_session_factory() as db:
            existing_report = await ReportService.get_report_by_analysis_id(db, analysis_id)
            if existing_report is not None:
                logger.info(
                    "[EVENT_IDEMPOTENT_SKIP] event_type=%s analysis_id=%s",
                    envelope.event_type,
                    analysis_id,
                )
                completed_event = build_event(
                    event_type="analysis.completed",
                    correlation_id=correlation_id,
                    payload=AnalysisCompletedPayload(
                        analysis_id=analysis_id,
                        report_id=existing_report.id,
                        generation_mode=existing_report.generation_mode,
                    ),
                )
                await broker.publish_event(completed_event)
                await message.ack()
                logger.info(
                    "[EVENT_ACK] event_type=%s event_id=%s analysis_id=%s",
                    envelope.event_type,
                    envelope.event_id,
                    analysis_id,
                )
                return

            profile, findings = await _fetch_quality_details(analysis_id)

            report = await report_service.synthesize_and_save_report(
                db=db,
                analysis_id=analysis_id,
                row_count=int(profile.get("row_count", 0)),
                column_count=int(profile.get("column_count", 0)),
                columns_summary=profile.get("columns_summary") or {},
                findings=findings,
            )

        completed_event = build_event(
            event_type="analysis.completed",
            correlation_id=correlation_id,
            payload=AnalysisCompletedPayload(
                analysis_id=analysis_id,
                report_id=report.id,
                generation_mode=report.generation_mode,
            ),
        )
        await broker.publish_event(completed_event)
        await message.ack()
        logger.info(
            "[EVENT_ACK] event_type=%s event_id=%s analysis_id=%s",
            envelope.event_type,
            envelope.event_id,
            analysis_id,
        )

    except QualityProfileNotFoundError as exc:
        await _safe_publish_failed(
            broker=broker,
            analysis_id=analysis_id,
            correlation_id=correlation_id,
            error_code="QUALITY_PROFILE_NOT_FOUND",
            error_message="Não foram encontrados os resultados de qualidade para gerar o relatório técnico.",
        )
        logger.error(
            "[EVENT_DLQ] event_type=%s event_id=%s analysis_id=%s reason=%s",
            envelope.event_type,
            envelope.event_id,
            analysis_id,
            f"QUALITY_PROFILE_NOT_FOUND: {exc}",
        )
        await message.nack(requeue=False)

    except Exception as exc:
        retry_count = _extract_retry_count(message)
        if retry_count < settings.RABBITMQ_MAX_RETRIES:
            next_attempt = retry_count + 1
            logger.warning(
                "[EVENT_RETRY] event_type=%s event_id=%s analysis_id=%s attempt=%d/%d error=%s",
                envelope.event_type,
                envelope.event_id,
                analysis_id,
                next_attempt,
                settings.RABBITMQ_MAX_RETRIES,
                exc,
            )
            try:
                await broker.republish_for_retry(message, next_attempt)
                await message.ack()
                return
            except Exception as retry_exc:
                logger.error(
                    "Falha ao republicar mensagem para retry (analysis_id=%s): %s",
                    analysis_id,
                    retry_exc,
                )

        await _safe_publish_failed(
            broker=broker,
            analysis_id=analysis_id,
            correlation_id=correlation_id,
            error_code="INTELLIGENCE_PROCESSING_FAILED",
            error_message="O serviço de inteligência não pôde concluir a síntese do relatório técnico.",
        )
        logger.error(
            "[EVENT_DLQ] event_type=%s event_id=%s analysis_id=%s reason=%s",
            envelope.event_type,
            envelope.event_id,
            analysis_id,
            f"INTELLIGENCE_PROCESSING_FAILED: {exc}",
        )
        await message.nack(requeue=False)
