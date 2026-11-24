import logging
from contextlib import asynccontextmanager
from functools import partial
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import v1_router
from app.config import settings
from app.database import init_db
from app.messaging import analysis_broker, handle_status_event

logging.basicConfig(level=settings.LOG_LEVEL)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Iniciando DataGuard Analysis Service...")
    try:
        await init_db()
        logger.info("Tabelas do banco de dados verificadas/inicializadas com sucesso.")
    except Exception as exc:
        logger.warning(
            "Não foi possível conectar ao banco de dados no momento da inicialização: %s. "
            "A aplicação continuará rodando para healthchecks e reconectará sob demanda.",
            exc,
        )

    if settings.MESSAGING_ENABLED:
        analysis_broker.set_consumer_callback(
            partial(handle_status_event, broker=analysis_broker)
        )
        try:
            await analysis_broker.connect()
            await analysis_broker.start_consuming()
        except Exception as exc:
            logger.warning(
                "Não foi possível inicializar o RabbitMQ no startup: %s. "
                "O serviço tentará reconectar sob demanda ao receber novos uploads.",
                exc,
            )

    yield

    if settings.MESSAGING_ENABLED:
        await analysis_broker.close()
    logger.info("Encerrando DataGuard Analysis Service...")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="DataGuard - Orquestrador de análises e API pública de auditoria de dados.",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router, prefix="/api")

@app.get(
    "/health",
    tags=["Health"],
    summary="Healthcheck endpoint",
    response_model=dict[str, str],
)
async def health_check() -> dict[str, str]:
    return {
        "status": "healthy",
        "service": "analysis-service",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "messaging_enabled": str(settings.MESSAGING_ENABLED),
        "messaging_connected": str(analysis_broker.is_connected),
    }


@app.get(
    "/",
    tags=["Root"],
    summary="Root endpoint",
    response_model=dict[str, str],
)
async def root() -> dict[str, str]:
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs_url": "/docs",
        "health_url": "/health",
    }
