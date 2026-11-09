import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

import httpx
from fastapi import BackgroundTasks, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session_factory
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
        com base na quantidade e severidade dos achados determinísticos.
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
        background_tasks: BackgroundTasks,
    ) -> AnalysisJobModel:
        """
        Recebe o arquivo CSV do upload, valida regras essenciais,
        salva no storage, insere o job imediatamente e agenda o pipeline assíncrono.
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

        file_ref_str = str(destination_path.resolve())
        job = AnalysisJobModel(
            id=job_id,
            original_filename=clean_filename,
            file_size_bytes=total_bytes,
            file_ref=file_ref_str,
            status=JobStatus.ENVIADA.value,
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)

        background_tasks.add_task(
            cls.run_pipeline_task,
            job_id,
            file_ref_str,
            clean_filename,
        )

        return job

    @classmethod
    async def run_pipeline_task(
        cls,
        job_id: UUID,
        file_ref: str,
        filename: str,
    ) -> None:
        """
        Executa o pipeline síncrono dos microsserviços em background,
        atualizando os status no banco do Supabase progressivamente.
        """
        logger.info("Iniciando pipeline síncrono para análise %s...", job_id)
        dq_url = f"{settings.DATA_QUALITY_SERVICE_URL.rstrip('/')}/internal"
        is_url = f"{settings.INTELLIGENCE_SERVICE_URL.rstrip('/')}/internal"

        async with async_session_factory() as db:
            job = await JobService.get_job_by_id(db, job_id)
            if not job:
                logger.error("Job %s não encontrado para processamento.", job_id)
                return

            # Etapa 1: Validando -> Analisando
            job.status = JobStatus.ANALISANDO.value
            await db.commit()

            profile_data = None
            findings_data = []

            csv_text = None
            try:
                if file_ref and os.path.exists(file_ref):
                    with open(file_ref, "r", encoding="utf-8", errors="replace") as f:
                        csv_text = f.read()
            except Exception as e:
                logger.warning("Falha ao ler arquivo CSV local para envio ao data-quality-service: %s", e)

            async with httpx.AsyncClient(timeout=settings.INTERNAL_TIMEOUT_SECONDS) as client:
                try:
                    logger.info("Chamando data-quality-service para job %s...", job_id)
                    dq_response = await client.post(
                        f"{dq_url}/process",
                        json={
                            "analysis_id": str(job_id),
                            "file_ref": file_ref,
                            "filename": filename,
                            "csv_content": csv_text,
                        },
                    )
                    if dq_response.status_code != 200:
                        raise Exception(f"data-quality-service respondeu {dq_response.status_code}: {dq_response.text}")
                except Exception as exc:
                    logger.error("Erro na chamada ao data-quality-service para job %s: %s", job_id, exc)
                    job.status = JobStatus.FALHOU.value
                    job.error_code = "DATA_QUALITY_SERVICE_UNAVAILABLE"
                    job.error_message = (
                        "O motor determinístico de qualidade está temporariamente indisponível ou demorou a responder."
                    )
                    await db.commit()
                    return

                try:
                    q_resp = await client.get(f"{dq_url}/quality/{job_id}")
                    if q_resp.status_code == 200:
                        q_json = q_resp.json()
                        profile_data = q_json.get("profile")
                        findings_data = q_json.get("findings", [])
                    else:
                        raise Exception("Falha ao recuperar detalhes de qualidade gerados.")
                except Exception as exc:
                    logger.error("Erro ao obter métricas de qualidade para job %s: %s", job_id, exc)
                    job.status = JobStatus.FALHOU.value
                    job.error_code = "QUALITY_DETAILS_FETCH_FAILED"
                    job.error_message = "Não foi possível recuperar os dados de qualidade processados."
                    await db.commit()
                    return

                job.status = JobStatus.GERANDO_RELATORIO.value
                await db.commit()

                try:
                    logger.info("Chamando intelligence-service para síntese do job %s...", job_id)
                    synth_payload = {
                        "analysis_id": str(job_id),
                        "row_count": profile_data.get("row_count", 0) if profile_data else 0,
                        "column_count": profile_data.get("column_count", 0) if profile_data else 0,
                        "columns_summary": profile_data.get("columns_summary", {}) if profile_data else {},
                        "findings": findings_data,
                    }
                    is_resp = await client.post(
                        f"{is_url}/synthesize",
                        json=synth_payload,
                    )
                    if is_resp.status_code != 200:
                        raise Exception(f"intelligence-service respondeu {is_resp.status_code}: {is_resp.text}")
                except Exception as exc:
                    logger.error("Erro na síntese de relatório para job %s: %s", job_id, exc)
                    job.status = JobStatus.FALHOU.value
                    job.error_code = "INTELLIGENCE_SERVICE_UNAVAILABLE"
                    job.error_message = "O serviço de inteligência e síntese técnica não pôde concluir o relatório."
                    await db.commit()
                    return

            # Etapa 3: Concluído com Sucesso
            job.status = JobStatus.CONCLUIDA.value
            job.completed_at = datetime.now(timezone.utc)
            await db.commit()
            logger.info("Pipeline do job %s CONCLUÍDO COM SUCESSO!", job_id)

    @classmethod
    async def get_full_analysis_report(
        cls,
        db: AsyncSession,
        job_id: UUID,
    ) -> FullAnalysisDetailsResponse | None:
        """
        Agrega o job, o perfil tabular, os achados de conformidade,
        o laudo de síntese e calcula o health_score unificado.
        Utiliza chamadas HTTP internas e fallback direto no Supabase.
        """
        job = await JobService.get_job_by_id(db, job_id)
        if not job:
            return None

        dq_url = f"{settings.DATA_QUALITY_SERVICE_URL.rstrip('/')}/internal"
        is_url = f"{settings.INTELLIGENCE_SERVICE_URL.rstrip('/')}/internal"

        profile_obj = None
        findings_objs = []
        report_obj = None

        # Search via HTTP interno
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
                logger.warning("Falha HTTP ao consultar qualidade de %s: %s", job_id, exc)

            try:
                resp = await client.get(f"{is_url}/reports/{job_id}")
                if resp.status_code == 200:
                    r_data = resp.json()
                    report_obj = QualityReportSchema.model_validate(r_data)
            except Exception as exc:
                logger.warning("Falha HTTP ao consultar relatório de %s: %s", job_id, exc)

        # Fallback direto no Supabase se falhar via HTTP
        if not profile_obj or not report_obj:
            try:
                from sqlalchemy import text
                if not profile_obj:
                    p_res = await db.execute(
                        text("SELECT id, analysis_id, row_count, column_count, columns_summary, generated_at FROM dataset_profiles WHERE analysis_id = :aid"),
                        {"aid": job_id},
                    )
                    p_row = p_res.mappings().first()
                    if p_row:
                        profile_obj = DatasetProfileSchema.model_validate(dict(p_row))

                    f_res = await db.execute(
                        text("SELECT id, analysis_id, code, severity, target_column, description, metric_value, evidence, created_at FROM quality_findings WHERE analysis_id = :aid"),
                        {"aid": job_id},
                    )
                    findings_objs = [QualityFindingSchema.model_validate(dict(r)) for r in f_res.mappings().all()]

                if not report_obj:
                    r_res = await db.execute(
                        text("SELECT id, analysis_id, executive_summary, key_insights, recommended_actions, limitations, generation_mode, generated_at FROM analysis_reports WHERE analysis_id = :aid ORDER BY generated_at DESC LIMIT 1"),
                        {"aid": job_id},
                    )
                    r_row = r_res.mappings().first()
                    if r_row:
                        report_obj = QualityReportSchema.model_validate(dict(r_row))
            except Exception as exc:
                logger.warning("Erro no fallback de banco para %s: %s", job_id, exc)

        findings_raw = [f.model_dump() for f in findings_objs]
        health_score = cls.calculate_health_score(findings_raw) if profile_obj else None

        return FullAnalysisDetailsResponse(
            job=JobResponse.model_validate(job),
            profile=profile_obj,
            findings=findings_objs,
            report=report_obj,
            health_score=health_score,
        )
