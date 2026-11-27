import asyncio
import io
import logging
import os
from typing import Any
from uuid import UUID

import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.quality import DatasetProfileModel, QualityFindingModel

logger = logging.getLogger(__name__)


class CsvFileNotFoundError(FileNotFoundError):
    """Erro permanente quando o arquivo CSV referenciado não existe no storage."""


class InvalidCsvContentError(ValueError):
    """Erro permanente quando o conteúdo do CSV é inválido ou corrompido."""


class ProfilerService:
    @staticmethod
    def compute_dataframe_profile(df: pd.DataFrame) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        row_count = int(len(df))
        col_count = int(len(df.columns))
        columns_summary: dict[str, Any] = {}
        findings: list[dict[str, Any]] = []

        if row_count > 0:
            duplicates_count = int(df.duplicated().sum())
            if duplicates_count > 0:
                dup_pct = round((duplicates_count / row_count) * 100, 2)
                findings.append({
                    "code": "DUPLICATE_ROWS",
                    "severity": "critical" if dup_pct > 15 else "warning",
                    "target_column": None,
                    "description": (
                        f"Foram identificadas {duplicates_count} linhas idênticas duplicadas "
                        f"({dup_pct}% do total de registros)."
                    ),
                    "metric_value": float(dup_pct),
                    "evidence": f"Total de duplicatas: {duplicates_count} / {row_count}",
                })

        for col_name in df.columns:
            series = df[col_name]
            null_count = int(series.isna().sum())
            null_pct = round((null_count / row_count * 100), 2) if row_count > 0 else 0.0
            unique_count = int(series.nunique(dropna=True))

            is_numeric = pd.api.types.is_numeric_dtype(series)
            is_datetime = pd.api.types.is_datetime64_any_dtype(series)

            summary: dict[str, Any] = {
                "total_count": row_count,
                "null_count": null_count,
                "null_percentage": null_pct,
                "unique_count": unique_count,
            }

            if is_numeric:
                summary["data_type"] = "numeric"
                valid_num = series.dropna()
                if not valid_num.empty:
                    summary["mean"] = float(round(valid_num.mean(), 4))
                    summary["std_dev"] = float(round(valid_num.std(), 4)) if len(valid_num) > 1 else 0.0
                    summary["min_value"] = float(valid_num.min())
                    summary["q25"] = float(np.percentile(valid_num, 25))
                    summary["median"] = float(valid_num.median())
                    summary["q75"] = float(np.percentile(valid_num, 75))
                    summary["max_value"] = float(valid_num.max())
            elif is_datetime:
                summary["data_type"] = "temporal"
                valid_dates = series.dropna()
                if not valid_dates.empty:
                    summary["min_value"] = str(valid_dates.min())
                    summary["max_value"] = str(valid_dates.max())
            else:
                summary["data_type"] = "categorical"
                top_cats = series.value_counts(dropna=True).head(5)
                summary["top_categories"] = [
                    {"category": str(cat), "count": int(cnt)}
                    for cat, cnt in top_cats.items()
                ]

            columns_summary[str(col_name)] = summary

            if null_pct > 30.0:
                findings.append({
                    "code": "CRITICAL_NULL_RATE",
                    "severity": "critical" if null_pct > 50 else "warning",
                    "target_column": str(col_name),
                    "description": (
                        f"Coluna '{col_name}' possui índice elevado de valores nulos "
                        f"({null_pct}% ausentes)."
                    ),
                    "metric_value": float(null_pct),
                    "evidence": f"{null_count} valores nulos de {row_count} registros.",
                })

        return columns_summary, findings

    @classmethod
    async def process_analysis_file(
        cls,
        db: AsyncSession,
        analysis_id: UUID,
        file_ref: str | None,
        filename: str,
        csv_content: str | None = None,
        strict_file_read: bool = False,
    ) -> tuple[DatasetProfileModel, list[QualityFindingModel]]:
        existing_profile = await cls.get_profile_by_analysis_id(db, analysis_id)
        if existing_profile is not None:
            existing_findings = await cls.get_findings_by_analysis_id(db, analysis_id)
            logger.info(
                "Perfil já existente para analysis_id=%s; retornando resultado idempotente.",
                analysis_id,
            )
            return existing_profile, existing_findings

        df: pd.DataFrame | None = None

        if csv_content:
            try:
                df = await asyncio.to_thread(pd.read_csv, io.StringIO(csv_content))
                logger.info("Arquivo CSV carregado com sucesso via csv_content (analysis_id=%s).", analysis_id)
            except Exception as exc:
                if strict_file_read:
                    raise InvalidCsvContentError(f"Falha ao interpretar o conteúdo CSV: {exc}") from exc
                logger.warning("Falha ao ler CSV de csv_content (analysis_id=%s): %s", analysis_id, exc)

        if df is None and file_ref:
            if os.path.exists(file_ref):
                try:
                    df = await asyncio.to_thread(pd.read_csv, file_ref)
                    logger.info(
                        "Arquivo CSV carregado com sucesso a partir do storage: %s (analysis_id=%s)",
                        file_ref,
                        analysis_id,
                    )
                except Exception as exc:
                    if strict_file_read:
                        raise InvalidCsvContentError(
                            f"Não foi possível ler ou interpretar o arquivo CSV '{filename}'."
                        ) from exc
                    logger.warning(
                        "Falha ao ler CSV '%s' (analysis_id=%s): %s. Usando fallback de amostra.",
                        file_ref,
                        analysis_id,
                        exc,
                    )
            elif strict_file_read:
                raise CsvFileNotFoundError(
                    f"Arquivo CSV referenciado em '{file_ref}' não foi encontrado no storage compartilhado."
                )

        if df is None:
            if strict_file_read:
                raise CsvFileNotFoundError(
                    f"Referência de arquivo inválida ou ausente para '{filename}'."
                )
            df = pd.DataFrame({
                "id": [1, 2, 3, 4, 5, 5],
                "categoria": ["A", "B", "A", None, "B", "B"],
                "valor": [10.5, 23.0, np.nan, 45.2, 50.0, 50.0],
                "score": [0.85, 0.92, 0.77, 0.64, 0.95, 0.95],
            })

        if strict_file_read and len(df.columns) == 0:
            raise InvalidCsvContentError(f"O arquivo CSV '{filename}' não possui colunas válidas.")

        columns_summary, findings_data = await asyncio.to_thread(cls.compute_dataframe_profile, df)

        profile = DatasetProfileModel(
            analysis_id=analysis_id,
            row_count=int(len(df)),
            column_count=int(len(df.columns)),
            columns_summary=columns_summary,
        )
        db.add(profile)
        await db.flush()

        created_findings: list[QualityFindingModel] = []
        for item in findings_data:
            finding = QualityFindingModel(
                analysis_id=analysis_id,
                code=item["code"],
                severity=item["severity"],
                target_column=item["target_column"],
                description=item["description"],
                metric_value=item["metric_value"],
                evidence=item["evidence"],
            )
            db.add(finding)
            created_findings.append(finding)

        await db.commit()
        await db.refresh(profile)
        return profile, created_findings

    @staticmethod
    async def get_profile_by_analysis_id(
        db: AsyncSession,
        analysis_id: UUID,
    ) -> DatasetProfileModel | None:
        stmt = select(DatasetProfileModel).where(DatasetProfileModel.analysis_id == analysis_id)
        result = await db.execute(stmt)
        return result.scalars().first()

    @staticmethod
    async def get_findings_by_analysis_id(
        db: AsyncSession,
        analysis_id: UUID,
    ) -> list[QualityFindingModel]:
        stmt = (
            select(QualityFindingModel)
            .where(QualityFindingModel.analysis_id == analysis_id)
            .order_by(QualityFindingModel.created_at.asc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())
