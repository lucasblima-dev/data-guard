from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.quality import (
    DatasetProfileResponse,
    ProcessQualityRequest,
    ProcessQualityResponse,
    QualityDetailsResponse,
    QualityFindingResponse,
)
from app.services.profiler import ProfilerService

router = APIRouter()


@router.post(
    "/process",
    response_model=ProcessQualityResponse,
    status_code=status.HTTP_200_OK,
    summary="Processar qualidade e perfilamento de dataset",
    description="Calcula deterministicamente as métricas descritivas e achados de qualidade para um arquivo CSV.",
)
async def process_quality(
    payload: ProcessQualityRequest,
    db: AsyncSession = Depends(get_db),
) -> ProcessQualityResponse:
    try:
        profile, findings = await ProfilerService.process_analysis_file(
            db=db,
            analysis_id=payload.analysis_id,
            file_ref=payload.file_ref,
            filename=payload.filename,
        )
        return ProcessQualityResponse(
            analysis_id=payload.analysis_id,
            status="completed",
            message="Perfilamento estatístico e achados de conformidade concluídos com sucesso.",
            profile_id=profile.id,
            findings_count=len(findings),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "QUALITY_PROCESSING_ERROR",
                "message": f"Erro interno ao processar a qualidade do dataset: {str(exc)}",
            },
        )


@router.get(
    "/quality/{analysis_id}",
    response_model=QualityDetailsResponse,
    status_code=status.HTTP_200_OK,
    summary="Consultar métricas e achados de qualidade por ID de análise",
    description="Retorna o perfil tabular e os achados identificados para a análise solicitada.",
)
async def get_quality_details(
    analysis_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> QualityDetailsResponse:
    profile = await ProfilerService.get_profile_by_analysis_id(db, analysis_id)
    findings = await ProfilerService.get_findings_by_analysis_id(db, analysis_id)

    profile_resp = DatasetProfileResponse.model_validate(profile) if profile else None
    findings_resp = [QualityFindingResponse.model_validate(f) for f in findings]

    return QualityDetailsResponse(
        analysis_id=analysis_id,
        profile=profile_resp,
        findings=findings_resp,
    )
