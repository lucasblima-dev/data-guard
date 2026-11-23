import json
import logging
from datetime import datetime, timezone
from uuid import UUID

from aio_pika.abc import AbstractIncomingMessage
from pydantic import ValidationError

from app.config import settings
from app.database import async_session_factory
from app.messaging.broker import AnalysisMessagingBroker
from app.messaging.events import (
    AnalysisCompletedPayload,
    AnalysisFailedPayload,
    EventEnvelope,
    QualityCompletedPayload,
    QualityStartedPayload,
)
from app.schemas.job import JobStatus
from app.services.job_service import JobService

logger = logging.getLogger(__name__)

TERMINAL_STATUSES = {
    JobStatus.CONCLUIDA.value,
    JobStatus.FALHOU.value,
}

STATUS_ORDER = {
    JobStatus.ENVIADA.value: 0,
    JobStatus.VALIDANDO.value: 1,
    JobStatus.ANALISANDO.value: 2,
    JobStatus.GERANDO_RELATORIO.value: 3,
    JobStatus.CONCLUIDA.value: 4,
    JobStatus.FALHOU.value: 4,
}

def _extract_retry_count(message: AbstractIncomingMessage) -> int:
    raw = (message.headers or {}).get("x-retry-count", 0)
    try:
        return int(raw)
    except (TypeError, ValueError):
        return 0

def _parse_status_transition(
    envelope: EventEnvelope,
) -> tuple[UUID, str, str | None, str | None, datetime | None]:
    event_type = envelope.event_type

    if event_type == "analysis.quality.started":
        payload = QualityStartedPayload.model_validate(envelope.payload)
        return payload.analysis_id, JobStatus.ANALISANDO.value, None, None, None

    if event_type == "analysis.quality.completed":
        payload = QualityCompletedPayload.model_validate(envelope.payload)
        return payload.analysis_id, JobStatus.GERANDO_RELATORIO.value, None, None, None

    if event_type == "analysis.completed":
        payload = AnalysisCompletedPayload.model_validate(envelope.payload)
        return (
            payload.analysis_id,
            JobStatus.CONCLUIDA.value,
            None,
            None,
            datetime.now(timezone.utc),
        )

    if event_type == "analysis.failed":
        payload = AnalysisFailedPayload.model_validate(envelope.payload)
        return (
            payload.analysis_id,
            JobStatus.FALHOU.value,
            payload.error_code,
            payload.error_message,
            None,
        )

    raise ValueError(f"Tipo de evento não suportado: '{event_type}'.")

async def handle_status_event(
    message: AbstractIncomingMessage,
    broker: AnalysisMessagingBroker,
) -> None:
    try:
        raw_data = json.loads(message.body.decode("utf-8"))
        envelope = EventEnvelope.model_validate(raw_data)
        (
            analysis_id,
            target_status,
            error_code,
            error_message,
            completed_at,
        ) = _parse_status_transition(envelope)
    except (UnicodeDecodeError, json.JSONDecodeError, ValidationError, ValueError) as exc:
        logger.error(
            "[EVENT_DLQ] event_type=%s event_id=%s analysis_id=None reason=%s",
            message.type or "unknown",
            message.message_id,
            f"INVALID_STATUS_EVENT: {exc}",
        )
        await message.nack(requeue=False)
        return

    logger.info(
        "[EVENT_RECEIVED] event_type=%s event_id=%s correlation_id=%s analysis_id=%s",
        envelope.event_type,
        envelope.event_id,
        envelope.correlation_id,
        analysis_id,
    )

    try:
        async with async_session_factory() as db:
            job = await JobService.get_job_by_id(db, analysis_id)
            if job is None:
                logger.error(
                    "[EVENT_DLQ] event_type=%s event_id=%s analysis_id=%s reason=JOB_NOT_FOUND",
                    envelope.event_type,
                    envelope.event_id,
                    analysis_id,
                )
                await message.nack(requeue=False)
                return

            if job.status in TERMINAL_STATUSES:
                logger.info(
                    "[EVENT_IDEMPOTENT_SKIP] event_type=%s analysis_id=%s current_status=%s",
                    envelope.event_type,
                    analysis_id,
                    job.status,
                )
                await message.ack()
                logger.info(
                    "[EVENT_ACK] event_type=%s event_id=%s analysis_id=%s",
                    envelope.event_type,
                    envelope.event_id,
                    analysis_id,
                )
                return

            current_rank = STATUS_ORDER.get(job.status, 0)
            target_rank = STATUS_ORDER.get(target_status, 0)
            if target_status != JobStatus.FALHOU.value and target_rank <= current_rank:
                logger.info(
                    "[EVENT_IDEMPOTENT_SKIP] event_type=%s analysis_id=%s current_status=%s target_status=%s",
                    envelope.event_type,
                    analysis_id,
                    job.status,
                    target_status,
                )
                await message.ack()
                logger.info(
                    "[EVENT_ACK] event_type=%s event_id=%s analysis_id=%s",
                    envelope.event_type,
                    envelope.event_id,
                    analysis_id,
                )
                return

            job.status = target_status
            if completed_at is not None:
                job.completed_at = completed_at
            if error_code is not None:
                job.error_code = error_code
            if error_message is not None:
                job.error_message = error_message

            await db.commit()

        await message.ack()
        logger.info(
            "[EVENT_ACK] event_type=%s event_id=%s analysis_id=%s new_status=%s",
            envelope.event_type,
            envelope.event_id,
            analysis_id,
            target_status,
        )

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
                    "Falha ao republicar evento de status para retry (analysis_id=%s): %s",
                    analysis_id,
                    retry_exc,
                )

        logger.error(
            "[EVENT_DLQ] event_type=%s event_id=%s analysis_id=%s reason=%s",
            envelope.event_type,
            envelope.event_id,
            analysis_id,
            f"STATUS_UPDATE_FAILED: {exc}",
        )
        await message.nack(requeue=False)
