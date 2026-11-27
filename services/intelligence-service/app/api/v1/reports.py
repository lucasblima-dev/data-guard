import time
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.schemas.report import (
    AnalysisReportResponse,
    LLMProbeResponse,
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


@router.post(
    "/llm/probe",
    response_model=LLMProbeResponse,
    status_code=status.HTTP_200_OK,
    summary="Diagnosticar conectividade e resposta real do modelo LLM",
    description=(
        "Executa uma síntese de diagnóstico usando metadados sintéticos para validar se o provedor "
        "configurado (Hugging Face ou Ollama) está respondendo em modo llm_assisted ou caindo em fallback."
    ),
)
async def probe_llm_provider() -> LLMProbeResponse:
    sample_columns = {
        "id_cliente": {
            "total_count": 120,
            "null_count": 0,
            "null_percentage": 0.0,
            "unique_count": 100,
            "data_type": "numeric",
        },
        "email": {
            "total_count": 120,
            "null_count": 48,
            "null_percentage": 40.0,
            "unique_count": 72,
            "data_type": "categorical",
        },
    }
    sample_findings = [
        {
            "code": "DUPLICATE_ROWS",
            "severity": "critical",
            "target_column": None,
            "description": "Foram identificadas 20 linhas idênticas duplicadas (16.67% do total de registros).",
            "metric_value": 16.67,
            "evidence": "Total de duplicatas: 20 / 120",
        },
        {
            "code": "CRITICAL_NULL_RATE",
            "severity": "warning",
            "target_column": "email",
            "description": "Coluna 'email' possui índice elevado de valores nulos (40.0% ausentes).",
            "metric_value": 40.0,
            "evidence": "48 valores nulos de 120 registros.",
        },
    ]

    dispatcher = report_service.dispatcher
    provider_name = settings.LLM_PROVIDER
    model_id = (
        settings.HF_MODEL_ID
        if provider_name == "huggingface"
        else settings.OLLAMA_MODEL
        if provider_name == "ollama"
        else "rules_only"
    )

    started = time.perf_counter()

    if not settings.LLM_ENABLED or provider_name == "disabled":
        fallback_report, mode = await dispatcher.rules_provider.generate_report_synthesis(
            row_count=120,
            column_count=2,
            columns_summary=sample_columns,
            findings=sample_findings,
        )
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        return LLMProbeResponse(
            llm_enabled=settings.LLM_ENABLED,
            configured_provider=provider_name,
            model_id=model_id,
            direct_provider_ok=False,
            generation_mode=mode,
            latency_ms=elapsed_ms,
            error_detail="LLM_ENABLED=false ou LLM_PROVIDER=disabled no ambiente.",
            sample_report=fallback_report,
        )

    target_provider = (
        dispatcher.hf_provider
        if provider_name == "huggingface"
        else dispatcher.ollama_provider
        if provider_name == "ollama"
        else None
    )

    if target_provider is None:
        fallback_report, mode = await dispatcher.rules_provider.generate_report_synthesis(
            row_count=120,
            column_count=2,
            columns_summary=sample_columns,
            findings=sample_findings,
        )
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        return LLMProbeResponse(
            llm_enabled=settings.LLM_ENABLED,
            configured_provider=provider_name,
            model_id=model_id,
            direct_provider_ok=False,
            generation_mode=mode,
            latency_ms=elapsed_ms,
            error_detail=f"Provedor desconhecido '{provider_name}'. Use 'huggingface' ou 'ollama'.",
            sample_report=fallback_report,
        )

    try:
        llm_report, mode = await target_provider.generate_report_synthesis(
            row_count=120,
            column_count=2,
            columns_summary=sample_columns,
            findings=sample_findings,
        )
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        return LLMProbeResponse(
            llm_enabled=settings.LLM_ENABLED,
            configured_provider=provider_name,
            model_id=model_id,
            direct_provider_ok=True,
            generation_mode=mode,
            latency_ms=elapsed_ms,
            error_detail=None,
            sample_report=llm_report,
        )
    except Exception as exc:
        fallback_report, mode = await dispatcher.rules_provider.generate_report_synthesis(
            row_count=120,
            column_count=2,
            columns_summary=sample_columns,
            findings=sample_findings,
        )
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        return LLMProbeResponse(
            llm_enabled=settings.LLM_ENABLED,
            configured_provider=provider_name,
            model_id=model_id,
            direct_provider_ok=False,
            generation_mode=mode,
            latency_ms=elapsed_ms,
            error_detail=str(exc),
            sample_report=fallback_report,
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
