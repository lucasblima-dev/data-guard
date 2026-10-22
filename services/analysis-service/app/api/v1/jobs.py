from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.job import JobCreate, JobListResponse, JobResponse, JobStatus, JobUpdate
from app.services.job_service import JobService

router = APIRouter()


@router.post(
    "",
    response_model=JobResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar nova análise",
    description="Registra uma nova solicitação de análise de qualidade de dados.",
)
async def create_analysis(
    payload: JobCreate,
    db: AsyncSession = Depends(get_db),
) -> JobResponse:
    job = await JobService.create_job(db, payload)
    return JobResponse.model_validate(job)


@router.get(
    "",
    response_model=JobListResponse,
    status_code=status.HTTP_200_OK,
    summary="Listar análises",
    description="Retorna a lista paginada de análises com filtro opcional por status.",
)
async def list_analyses(
    page: int = Query(default=1, ge=1, description="Número da página (iniciando em 1)"),
    page_size: int = Query(default=10, ge=1, le=100, description="Itens por página (máximo 100)"),
    status_filter: JobStatus | None = Query(default=None, alias="status", description="Filtrar por status"),
    db: AsyncSession = Depends(get_db),
) -> JobListResponse:
    return await JobService.list_jobs(
        db=db,
        page=page,
        page_size=page_size,
        status=status_filter,
    )


@router.get(
    "/{job_id}",
    response_model=JobResponse,
    status_code=status.HTTP_200_OK,
    summary="Consultar análise por ID",
    description="Retorna os detalhes e metadados de uma análise específica.",
)
async def get_analysis(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> JobResponse:
    job = await JobService.get_job_by_id(db, job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "JOB_NOT_FOUND",
                "message": f"Análise com o ID '{job_id}' não foi encontrada.",
            },
        )
    return JobResponse.model_validate(job)


@router.patch(
    "/{job_id}",
    response_model=JobResponse,
    status_code=status.HTTP_200_OK,
    summary="Atualizar status ou metadados da análise",
    description="Permite atualizar parcialmente os dados ou o status de uma análise.",
)
async def update_analysis(
    job_id: UUID,
    payload: JobUpdate,
    db: AsyncSession = Depends(get_db),
) -> JobResponse:
    job = await JobService.get_job_by_id(db, job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "JOB_NOT_FOUND",
                "message": f"Análise com o ID '{job_id}' não foi encontrada.",
            },
        )
    updated_job = await JobService.update_job(db, job, payload)
    return JobResponse.model_validate(updated_job)


@router.put(
    "/{job_id}",
    response_model=JobResponse,
    status_code=status.HTTP_200_OK,
    summary="Atualizar análise (substituição / PUT)",
    description="Endpoint idempotente para atualização de estado e dados da análise.",
)
async def put_analysis(
    job_id: UUID,
    payload: JobUpdate,
    db: AsyncSession = Depends(get_db),
) -> JobResponse:
    return await update_analysis(job_id, payload, db)


@router.delete(
    "/{job_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Excluir análise",
    description="Remove uma análise do banco de dados.",
)
async def delete_analysis(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    job = await JobService.get_job_by_id(db, job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "JOB_NOT_FOUND",
                "message": f"Análise com o ID '{job_id}' não foi encontrada.",
            },
        )
    await JobService.delete_job(db, job)
