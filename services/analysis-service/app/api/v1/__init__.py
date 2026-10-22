from fastapi import APIRouter

from app.api.v1.jobs import router as jobs_router

v1_router = APIRouter()
v1_router.include_router(jobs_router, prefix="/analyses", tags=["Analyses"])

__all__ = ["v1_router"]
