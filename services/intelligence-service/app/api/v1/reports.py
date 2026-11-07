from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.report import (
    AnalysisReportResponse,
    SynthesizeReportRequest,
    SynthesizeReportResponse,
)
from app.services.report_service import ReportService

router = APIRouter()
report_service = ReportService()


@router.post(
    "/synthesize",
    response_model=SynthesizeReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Gerar laudo técnico e síntese executiva",
    description="Sintetiza métricas e achados via IA (Hugging Face / Ollama) com fallback determinístico e persiste o laudo.",
)
async def synthesize_report(
    payload: SynthesizeReportRequest,
    db: AsyncSession = Depends(get_db),
) -> SynthesizeReportResponse:
    try:
        report = await report_service.synthesize_and_save_report(
            db=db,
            analysis_id=payload.analysis_id,
            row_count=payload.row_count,
            column_count=payload.column_count,
            columns_summary=payload.columns_summary,
            findings=payload.findings,
        )
        return SynthesizeReportResponse(
            analysis_id=payload.analysis_id,
            report_id=report.id,
            status="completed",
            generation_mode=report.generation_mode,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "REPORT_SYNTHESIS_ERROR",
                "message": f"Erro interno ao sintetizar o relatório técnico: {str(exc)}",
            },
        )


@router.get(
    "/reports/{analysis_id}",
    response_model=AnalysisReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Consultar relatório executivo por ID de análise",
    description="Recupera o relatório gerado com resumo executivo, insights de IA e ações recomendadas.",
)
async def get_report_by_analysis(
    analysis_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> AnalysisReportResponse:
    report = await ReportService.get_report_by_analysis_id(db, analysis_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "REPORT_NOT_FOUND",
                "message": f"Relatório técnico para a análise '{analysis_id}' não foi encontrado.",
            },
        )
    return AnalysisReportResponse.model_validate(report)
