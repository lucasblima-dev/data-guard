import json
import logging
from uuid import UUID

from aio_pika.abc import AbstractIncomingMessage
from pydantic import ValidationError

from app.config import settings
from app.database import async_session_factory
from app.messaging.broker import QualityMessagingBroker
from app.messaging.events import (
    AnalysisFailedPayload,
    AnalysisRequestedPayload,
    EventEnvelope,
    QualityCompletedPayload,
    QualityStartedPayload,
    build_event,
)
from app.services.profiler import (
    CsvFileNotFoundError,
    InvalidCsvContentError,
    ProfilerService,
)

logger = logging.getLogger(__name__)


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
    broker: QualityMessagingBroker,
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
                stage="quality",
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


async def handle_analysis_requested(
    message: AbstractIncomingMessage,
    broker: QualityMessagingBroker,
) -> None:
    try:
        raw_data = json.loads(message.body.decode("utf-8"))
        envelope = EventEnvelope.model_validate(raw_data)
        payload = AnalysisRequestedPayload.model_validate(envelope.payload)
    except (UnicodeDecodeError, json.JSONDecodeError, ValidationError) as exc:
        fallback_analysis_id = _try_extract_analysis_id(message.body)
        if fallback_analysis_id is not None:
            await _safe_publish_failed(
                broker=broker,
                analysis_id=fallback_analysis_id,
                correlation_id=fallback_analysis_id,
                error_code="INVALID_EVENT_PAYLOAD",
                error_message="Payload inválido recebido pelo motor de qualidade de dados.",
            )
        logger.error(
            "[EVENT_DLQ] event_type=analysis.requested event_id=%s analysis_id=%s reason=%s",
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
            existing_profile = await ProfilerService.get_profile_by_analysis_id(db, analysis_id)
            if existing_profile is not None:
                existing_findings = await ProfilerService.get_findings_by_analysis_id(db, analysis_id)
                logger.info(
                    "[EVENT_IDEMPOTENT_SKIP] event_type=%s analysis_id=%s",
                    envelope.event_type,
                    analysis_id,
                )
                completed_event = build_event(
                    event_type="analysis.quality.completed",
                    correlation_id=correlation_id,
                    payload=QualityCompletedPayload(
                        analysis_id=analysis_id,
                        profile_id=existing_profile.id,
                        findings_count=len(existing_findings),
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

            started_event = build_event(
                event_type="analysis.quality.started",
                correlation_id=correlation_id,
                payload=QualityStartedPayload(analysis_id=analysis_id),
            )
            await broker.publish_event(started_event)

            profile, findings = await ProfilerService.process_analysis_file(
                db=db,
                analysis_id=analysis_id,
                file_ref=payload.file_ref,
                filename=payload.filename,
                strict_file_read=True,
            )

        completed_event = build_event(
            event_type="analysis.quality.completed",
            correlation_id=correlation_id,
            payload=QualityCompletedPayload(
                analysis_id=analysis_id,
                profile_id=profile.id,
                findings_count=len(findings),
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

    except CsvFileNotFoundError as exc:
        await _safe_publish_failed(
            broker=broker,
            analysis_id=analysis_id,
            correlation_id=correlation_id,
            error_code="CSV_FILE_NOT_FOUND",
            error_message="O arquivo CSV enviado não foi encontrado no armazenamento compartilhado.",
        )
        logger.error(
            "[EVENT_DLQ] event_type=%s event_id=%s analysis_id=%s reason=%s",
            envelope.event_type,
            envelope.event_id,
            analysis_id,
            f"CSV_FILE_NOT_FOUND: {exc}",
        )
        await message.nack(requeue=False)

    except InvalidCsvContentError as exc:
        await _safe_publish_failed(
            broker=broker,
            analysis_id=analysis_id,
            correlation_id=correlation_id,
            error_code="INVALID_CSV_CONTENT",
            error_message="Não foi possível interpretar o arquivo CSV. Verifique a estrutura e codificação.",
        )
        logger.error(
            "[EVENT_DLQ] event_type=%s event_id=%s analysis_id=%s reason=%s",
            envelope.event_type,
            envelope.event_id,
            analysis_id,
            f"INVALID_CSV_CONTENT: {exc}",
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
            error_code="QUALITY_PROCESSING_FAILED",
            error_message="O motor determinístico de qualidade não pôde processar o arquivo após novas tentativas.",
        )
        logger.error(
            "[EVENT_DLQ] event_type=%s event_id=%s analysis_id=%s reason=%s",
            envelope.event_type,
            envelope.event_id,
            analysis_id,
            f"QUALITY_PROCESSING_FAILED: {exc}",
        )
        await message.nack(requeue=False)
