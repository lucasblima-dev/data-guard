import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

import httpx
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.job import AnalysisJobModel
from app.schemas.job import JobResponse, JobStatus
from app.schemas.report import (
    DatasetProfileSchema,
    FullAnalysisDetailsResponse,
    QualityFindingSchema,
    QualityReportSchema,
)
from app.services.job_service import JobService

logger = logging.getLogger(__name__)


class OrchestratorService:
    @staticmethod
    def calculate_health_score(findings: list[dict]) -> int:
        """
        Calcula nota de integridade e saude do dataset (0-100)
        com base na quantidade e severidade dos achados.
        """
        score = 100
        for f in findings:
            sev = f.get("severity")
            if sev == "critical":
                score -= 15
            elif sev == "warning":
                score -= 5
            elif sev == "info":
                score -= 1
        return max(0, min(100, score))

    @classmethod
    async def create_analysis_from_upload(
        cls,
        db: AsyncSession,
        file: UploadFile,
    ) -> AnalysisJobModel:
        """
        Recebe o arquivo CSV do upload, valida regras essenciais,
        salva no storage compartilhado e inicia o pipeline síncrono.
        """
        if not file.filename or not file.filename.lower().endswith(".csv"):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail={
                    "code": "INVALID_FILE_FORMAT",
                    "message": "Formato de arquivo inválido. Apenas arquivos CSV (.csv) são aceitos.",
                },
            )

        storage_path = Path(settings.STORAGE_DIR)
        storage_path.mkdir(parents=True, exist_ok=True)

        job_id = uuid4()
        clean_filename = Path(file.filename).name
        saved_file_name = f"{job_id}_{clean_filename}"
        destination_path = storage_path / saved_file_name

        total_bytes = 0
        max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024

        try:
            with destination_path.open("wb") as buffer:
                while chunk := await file.read(1024 * 1024):  # 1MB por chunk
                    total_bytes += len(chunk)
                    if total_bytes > max_bytes:
                        raise HTTPException(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail={
                                "code": "FILE_TOO_LARGE",
                                "message": f"O arquivo excede o limite máximo permitido de {settings.MAX_FILE_SIZE_MB}MB.",
                            },
                        )
                    buffer.write(chunk)
        except HTTPException:
            if destination_path.exists():
                destination_path.unlink()
            raise
        except Exception as exc:
            if destination_path.exists():
                destination_path.unlink()
            logger.error("Erro ao salvar arquivo no storage: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "code": "STORAGE_WRITE_ERROR",
                    "message": "Não foi possível gravar o arquivo temporário no storage.",
                },
            )

        job = AnalysisJobModel(
            id=job_id,
            original_filename=clean_filename,
            file_size_bytes=total_bytes,
            file_ref=str(destination_path.resolve()),
            status=JobStatus.ENVIADA.value,
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)

        await cls.run_synchronous_pipeline(db, job)
        return job

    @classmethod
    async def run_synchronous_pipeline(
        cls,
        db: AsyncSession,
        job: AnalysisJobModel,
    ) -> None:
        """
        Coordena síncronamente o fluxo entre data-quality-service e intelligence-service
        com controle rigoroso de timeouts e tolerância a falhas.
        """
        # Etapa A: Validação e Início da Análise Tabular
        job.status = JobStatus.ANALISANDO.value
        await db.commit()
        await db.refresh(job)

        dq_url = f"{settings.DATA_QUALITY_SERVICE_URL.rstrip('/')}/internal"
        is_url = f"{settings.INTELLIGENCE_SERVICE_URL.rstrip('/')}/internal"

        profile_data = None
        findings_data = []

        async with httpx.AsyncClient(timeout=settings.INTERNAL_TIMEOUT_SECONDS) as client:
            try:
                dq_response = await client.post(
                    f"{dq_url}/process",
                    json={
                        "analysis_id": str(job.id),
                        "file_ref": job.file_ref,
                        "filename": job.original_filename,
                    },
                )
                if dq_response.status_code != 200:
                    raise Exception(f"Data Quality Service respondeu {dq_response.status_code}: {dq_response.text}")
            except Exception as exc:
                logger.error("Falha ao comunicar com data-quality-service: %s", exc)
                job.status = JobStatus.FALHOU.value
                job.error_code = "DATA_QUALITY_SERVICE_UNAVAILABLE"
                job.error_message = (
                    "O motor determinístico de qualidade está temporariamente indisponível "
                    "ou excedeu o tempo limite."
                )
                await db.commit()
                return

            try:
                quality_details_resp = await client.get(f"{dq_url}/quality/{job.id}")
                if quality_details_resp.status_code == 200:
                    q_json = quality_details_resp.json()
                    profile_data = q_json.get("profile")
                    findings_data = q_json.get("findings", [])
                else:
                    raise Exception("Falha ao obter detalhes de perfilamento calculados.")
            except Exception as exc:
                logger.error("Erro ao obter resultados do data-quality-service: %s", exc)
                job.status = JobStatus.FALHOU.value
                job.error_code = "QUALITY_DETAILS_FETCH_FAILED"
                job.error_message = "Não foi possível recuperar os dados de qualidade processados."
                await db.commit()
                return

            job.status = JobStatus.GERANDO_RELATORIO.value
            await db.commit()
            await db.refresh(job)

            try:
                synthesize_payload = {
                    "analysis_id": str(job.id),
                    "row_count": profile_data.get("row_count", 0) if profile_data else 0,
                    "column_count": profile_data.get("column_count", 0) if profile_data else 0,
                    "columns_summary": profile_data.get("columns_summary", {}) if profile_data else {},
                    "findings": findings_data,
                }
                is_response = await client.post(
                    f"{is_url}/synthesize",
                    json=synthesize_payload,
                )
                if is_response.status_code != 200:
                    raise Exception(f"Intelligence Service respondeu {is_response.status_code}: {is_response.text}")
            except Exception as exc:
                logger.warning("Falha na chamada ao intelligence-service: %s", exc)
                job.status = JobStatus.FALHOU.value
                job.error_code = "INTELLIGENCE_SERVICE_UNAVAILABLE"
                job.error_message = (
                    "O serviço de inteligência e síntese técnica não pôde concluir o relatório a tempo."
                )
                await db.commit()
                return

        job.status = JobStatus.CONCLUIDA.value
        job.completed_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(job)
        logger.info("Análise %s concluída com sucesso em todos os microsserviços.", job.id)

    @classmethod
    async def get_full_analysis_report(
        cls,
        db: AsyncSession,
        job_id: UUID,
    ) -> FullAnalysisDetailsResponse | None:
        """
        Agrega o job, o perfil tabular, os achados de conformidade,
        o laudo de síntese e calcula o health_score unificado.
        """
        job = await JobService.get_job_by_id(db, job_id)
        if not job:
            return None

        dq_url = f"{settings.DATA_QUALITY_SERVICE_URL.rstrip('/')}/internal"
        is_url = f"{settings.INTELLIGENCE_SERVICE_URL.rstrip('/')}/internal"

        profile_obj = None
        findings_objs = []
        report_obj = None

        async with httpx.AsyncClient(timeout=settings.INTERNAL_TIMEOUT_SECONDS) as client:
            try:
                resp = await client.get(f"{dq_url}/quality/{job_id}")
                if resp.status_code == 200:
                    q_data = resp.json()
                    if q_data.get("profile"):
                        profile_obj = DatasetProfileSchema.model_validate(q_data["profile"])
                    if q_data.get("findings"):
                        findings_objs = [
                            QualityFindingSchema.model_validate(f)
                            for f in q_data["findings"]
                        ]
            except Exception as exc:
                logger.warning("Não foi possível buscar qualidade de %s: %s", job_id, exc)

            try:
                resp = await client.get(f"{is_url}/reports/{job_id}")
                if resp.status_code == 200:
                    r_data = resp.json()
                    report_obj = QualityReportSchema.model_validate(r_data)
            except Exception as exc:
                logger.warning("Não foi possível buscar relatório de %s: %s", job_id, exc)

        findings_raw = [f.model_dump() for f in findings_objs]
        health_score = cls.calculate_health_score(findings_raw) if profile_obj else None

        return FullAnalysisDetailsResponse(
            job=JobResponse.model_validate(job),
            profile=profile_obj,
            findings=findings_objs,
            report=report_obj,
            health_score=health_score,
        )
