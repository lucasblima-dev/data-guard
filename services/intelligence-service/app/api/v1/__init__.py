from fastapi import APIRouter

from app.api.v1.reports import router as reports_router

v1_router = APIRouter()
v1_router.include_router(reports_router, tags=["Intelligence & Reports"])
