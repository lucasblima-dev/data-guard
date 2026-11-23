import asyncio
import logging
from collections.abc import Awaitable, Callable

import aio_pika
from aio_pika import DeliveryMode, ExchangeType, Message
from aio_pika.abc import (
    AbstractChannel,
    AbstractExchange,
    AbstractIncomingMessage,
    AbstractQueue,
    AbstractRobustConnection,
)

from app.config import settings
from app.messaging.events import EventEnvelope

logger = logging.getLogger(__name__)

INTELLIGENCE_REQUESTED_QUEUE = "dataguard.intelligence.requested"
INTELLIGENCE_DLQ_QUEUE = "dataguard.intelligence.dlq"
ROUTING_QUALITY_COMPLETED = "analysis.quality.completed"


class IntelligenceMessagingBroker:
    def __init__(self) -> None:
        self._connection: AbstractRobustConnection | None = None
        self._channel: AbstractChannel | None = None
        self._exchange: AbstractExchange | None = None
        self._queue: AbstractQueue | None = None
        self._consumer_tag: str | None = None

    @property
    def is_connected(self) -> bool:
        return self._connection is not None and not self._connection.is_closed

    async def connect(self, max_attempts: int = 10, retry_delay: float = 2.0) -> None:
        if not settings.RABBITMQ_URL:
            raise RuntimeError("RABBITMQ_URL não configurada para conexão AMQP.")

        last_exc: Exception | None = None
        for attempt in range(1, max_attempts + 1):
            try:
                self._connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
                break
            except Exception as exc:
                last_exc = exc
                if attempt == max_attempts:
                    raise
                logger.warning(
                    "Tentativa %d/%d de conexão ao RabbitMQ falhou (%s). Tentando novamente em %.1fs...",
                    attempt,
                    max_attempts,
                    exc,
                    retry_delay,
                )
                await asyncio.sleep(retry_delay)

        if self._connection is None:
            raise RuntimeError(f"Falha ao conectar ao RabbitMQ: {last_exc}")

        self._channel = await self._connection.channel()
        await self._channel.set_qos(prefetch_count=settings.RABBITMQ_PREFETCH_COUNT)

        self._exchange = await self._channel.declare_exchange(
            settings.RABBITMQ_EXCHANGE,
            ExchangeType.TOPIC,
            durable=True,
        )
        dlx = await self._channel.declare_exchange(
            settings.RABBITMQ_DLX,
            ExchangeType.DIRECT,
            durable=True,
        )

        dlq = await self._channel.declare_queue(
            INTELLIGENCE_DLQ_QUEUE,
            durable=True,
        )
        await dlq.bind(dlx, routing_key=INTELLIGENCE_DLQ_QUEUE)

        self._queue = await self._channel.declare_queue(
            INTELLIGENCE_REQUESTED_QUEUE,
            durable=True,
            arguments={
                "x-dead-letter-exchange": settings.RABBITMQ_DLX,
                "x-dead-letter-routing-key": INTELLIGENCE_DLQ_QUEUE,
            },
        )
        await self._queue.bind(self._exchange, routing_key=ROUTING_QUALITY_COMPLETED)

        logger.info(
            "Topologia AMQP declarada no intelligence-service (exchange=%s, queue=%s, dlq=%s).",
            settings.RABBITMQ_EXCHANGE,
            INTELLIGENCE_REQUESTED_QUEUE,
            INTELLIGENCE_DLQ_QUEUE,
        )

    async def start_consuming(
        self,
        callback: Callable[[AbstractIncomingMessage], Awaitable[None]],
    ) -> None:
        if self._queue is None:
            raise RuntimeError("Fila AMQP não inicializada antes de iniciar o consumo.")

        self._consumer_tag = await self._queue.consume(callback, no_ack=False)
        logger.info(
            "Consumidor AMQP ativo na fila '%s' (prefetch=%d).",
            INTELLIGENCE_REQUESTED_QUEUE,
            settings.RABBITMQ_PREFETCH_COUNT,
        )

    async def publish_event(
        self,
        event: EventEnvelope,
        routing_key: str | None = None,
    ) -> None:
        if self._exchange is None:
            raise RuntimeError("Exchange AMQP não inicializada para publicação.")

        target_key = routing_key or event.event_type
        body = event.model_dump_json().encode("utf-8")
        amqp_message = Message(
            body=body,
            delivery_mode=DeliveryMode.PERSISTENT,
            content_type="application/json",
            message_id=str(event.event_id),
            correlation_id=str(event.correlation_id),
            type=event.event_type,
        )
        await self._exchange.publish(amqp_message, routing_key=target_key)
        logger.info(
            "[EVENT_PUBLISHED] event_type=%s event_id=%s correlation_id=%s analysis_id=%s",
            event.event_type,
            event.event_id,
            event.correlation_id,
            event.payload.get("analysis_id"),
        )

    async def republish_for_retry(
        self,
        incoming_message: AbstractIncomingMessage,
        retry_count: int,
    ) -> None:
        if self._channel is None:
            raise RuntimeError("Canal AMQP não inicializado para retry.")

        await asyncio.sleep(settings.RABBITMQ_RETRY_DELAY_SECONDS)
        headers = dict(incoming_message.headers or {})
        headers["x-retry-count"] = retry_count

        retry_message = Message(
            body=incoming_message.body,
            delivery_mode=DeliveryMode.PERSISTENT,
            content_type=incoming_message.content_type or "application/json",
            message_id=incoming_message.message_id,
            correlation_id=incoming_message.correlation_id,
            type=incoming_message.type,
            headers=headers,
        )
        await self._channel.default_exchange.publish(
            retry_message,
            routing_key=INTELLIGENCE_REQUESTED_QUEUE,
        )

    async def close(self) -> None:
        if self._queue is not None and self._consumer_tag is not None:
            try:
                await self._queue.cancel(self._consumer_tag)
            except Exception as exc:
                logger.warning("Erro ao cancelar consumidor AMQP: %s", exc)
            self._consumer_tag = None

        if self._channel is not None and not self._channel.is_closed:
            await self._channel.close()
        if self._connection is not None and not self._connection.is_closed:
            await self._connection.close()
        logger.info("Conexão AMQP do intelligence-service encerrada.")
