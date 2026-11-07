import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import v1_router
from app.config import settings
from app.database import init_db

logging.basicConfig(level=settings.LOG_LEVEL)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Iniciando DataGuard Data Quality Service...")
    try:
        await init_db()
        logger.info("Tabelas de qualidade verificadas/inicializadas com sucesso no banco de dados.")
    except Exception as exc:
        logger.warning(
            "Não foi possível conectar ao banco de dados no momento da inicialização: %s. "
            "A aplicação continuará rodando para healthchecks e reconectará sob demanda.",
            exc,
        )
    yield
    logger.info("Encerrando DataGuard Data Quality Service...")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="DataGuard - Motor analítico determinístico de dados tabulares.",
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
    return {
        "status": "healthy",
        "service": "data-quality-service",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
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
