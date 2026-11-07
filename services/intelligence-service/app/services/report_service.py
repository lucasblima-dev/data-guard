import logging
from uuid import UUID
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.report import AnalysisReportModel
from app.providers.dispatcher import ReportDispatcher

logger = logging.getLogger(__name__)


class ReportService:
    def __init__(self) -> None:
        self.dispatcher = ReportDispatcher()

    async def synthesize_and_save_report(
        self,
        db: AsyncSession,
        analysis_id: UUID,
        row_count: int,
        column_count: int,
        columns_summary: dict[str, Any],
        findings: list[dict[str, Any]],
    ) -> AnalysisReportModel:
        """Gera síntese técnica via IA (ou fallback) e persiste o laudo no banco."""
        llm_response, generation_mode = await self.dispatcher.synthesize(
            row_count=row_count,
            column_count=column_count,
            columns_summary=columns_summary,
            findings=findings,
        )

        # Converte os insights tipados para dicionários compatíveis com JSONB
        serialized_insights = [insight.model_dump() for insight in llm_response.key_insights]

        report = AnalysisReportModel(
            analysis_id=analysis_id,
            executive_summary=llm_response.executive_summary,
            key_insights=serialized_insights,
            recommended_actions=llm_response.recommended_actions,
            limitations=llm_response.limitations,
            generation_mode=generation_mode,
        )

        db.add(report)
        await db.commit()
        await db.refresh(report)
        logger.info(
            "Relatório da análise '%s' persistido com sucesso (modo: %s).",
            analysis_id,
            generation_mode,
        )
        return report

    @staticmethod
    async def get_report_by_analysis_id(
        db: AsyncSession,
        analysis_id: UUID,
    ) -> AnalysisReportModel | None:
        """Recupera o relatório gerado a partir do ID da análise."""
        stmt = (
            select(AnalysisReportModel)
            .where(AnalysisReportModel.analysis_id == analysis_id)
            .order_by(AnalysisReportModel.generated_at.desc())
        )
        result = await db.execute(stmt)
        return result.scalars().first()
