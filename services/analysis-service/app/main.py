from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager for startup and shutdown hooks."""
    yield


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


@app.get(
    "/health",
    tags=["Health"],
    summary="Healthcheck endpoint",
    response_model=dict[str, str],
)
async def health_check() -> dict[str, str]:
    """Verify application health and availability."""
    return {
        "status": "healthy",
        "service": "analysis-service",
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
    """Root info endpoint providing documentation links."""
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs_url": "/docs",
        "health_url": "/health",
    }
