from fastapi import APIRouter

from app.api.v1.quality import router as quality_router

v1_router = APIRouter()
v1_router.include_router(quality_router, tags=["Quality & Profiling"])
