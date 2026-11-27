import logging
from contextlib import asynccontextmanager
from functools import partial
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import v1_router
from app.config import settings
from app.database import init_db
from app.messaging import IntelligenceMessagingBroker, handle_quality_completed
from app.services.report_service import ReportService

logging.basicConfig(level=settings.LOG_LEVEL)
logger = logging.getLogger(__name__)

messaging_broker = IntelligenceMessagingBroker()
messaging_report_service = ReportService()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Iniciando DataGuard Intelligence Service...")
    try:
        await init_db()
        logger.info("Tabelas de relatórios verificadas/inicializadas com sucesso no banco de dados.")
    except Exception as exc:
        logger.warning(
            "Não foi possível conectar ao banco de dados no momento da inicialização: %s. "
            "A aplicação continuará rodando para healthchecks e reconectará sob demanda.",
            exc,
        )

    if settings.MESSAGING_ENABLED:
        try:
            await messaging_broker.connect()
            await messaging_broker.start_consuming(
                partial(
                    handle_quality_completed,
                    broker=messaging_broker,
                    report_service=messaging_report_service,
                )
            )
        except Exception as exc:
            logger.warning(
                "Não foi possível inicializar o consumidor RabbitMQ no startup: %s. "
                "As rotas HTTP internas continuam operacionais.",
                exc,
            )

    yield

    if settings.MESSAGING_ENABLED:
        await messaging_broker.close()
    logger.info("Encerrando DataGuard Intelligence Service...")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="DataGuard - Agregador de relatórios e motor de síntese técnica híbrido (LLM + Fallback).",
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

app.include_router(v1_router, prefix="/internal")


@app.get(
    "/health",
    tags=["Health"],
    summary="Healthcheck endpoint",
    response_model=dict[str, str],
)
async def health_check() -> dict[str, str]:
    model_id = (
        settings.HF_MODEL_ID
        if settings.LLM_PROVIDER == "huggingface"
        else settings.OLLAMA_MODEL
        if settings.LLM_PROVIDER == "ollama"
        else "rules_only"
    )
    return {
        "status": "healthy",
        "service": "intelligence-service",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "llm_provider": settings.LLM_PROVIDER,
        "llm_enabled": str(settings.LLM_ENABLED),
        "llm_model": model_id,
        "hf_token_configured": str(bool(settings.HF_TOKEN)),
        "messaging_enabled": str(settings.MESSAGING_ENABLED),
        "messaging_connected": str(messaging_broker.is_connected),
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
