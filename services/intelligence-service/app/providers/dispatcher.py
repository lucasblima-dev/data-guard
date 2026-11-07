import logging
from typing import Any

from app.config import settings
from app.providers.base import BaseLLMProvider
from app.providers.huggingface import HuggingFaceProvider
from app.providers.ollama import OllamaProvider
from app.providers.rules import RulesOnlyProvider
from app.schemas.report import ReportLLMResponse

logger = logging.getLogger(__name__)


class ReportDispatcher:
    def __init__(self) -> None:
        self.rules_provider = RulesOnlyProvider()
        self.hf_provider = HuggingFaceProvider()
        self.ollama_provider = OllamaProvider()

    async def synthesize(
        self,
        row_count: int,
        column_count: int,
        columns_summary: dict[str, Any],
        findings: list[dict[str, Any]],
    ) -> tuple[ReportLLMResponse, str]:
        if not settings.LLM_ENABLED or settings.LLM_PROVIDER == "disabled":
            logger.info("IA desativada por configuração (LLM_ENABLED=False ou LLM_PROVIDER=disabled).")
            return await self.rules_provider.generate_report_synthesis(
                row_count=row_count,
                column_count=column_count,
                columns_summary=columns_summary,
                findings=findings,
            )

        provider: BaseLLMProvider | None = None
        if settings.LLM_PROVIDER == "huggingface":
            provider = self.hf_provider
        elif settings.LLM_PROVIDER == "ollama":
            provider = self.ollama_provider

        if provider:
            try:
                logger.info(
                    "Tentando síntese via IA com provedor '%s'...",
                    provider.provider_name,
                )
                return await provider.generate_report_synthesis(
                    row_count=row_count,
                    column_count=column_count,
                    columns_summary=columns_summary,
                    findings=findings,
                )
            except Exception as exc:
                logger.warning(
                    "Falha no provedor de IA '%s': %s. Ativando fallback para regras determinísticas...",
                    provider.provider_name,
                    exc,
                )

        # fallback de segurança
        return await self.rules_provider.generate_report_synthesis(
            row_count=row_count,
            column_count=column_count,
            columns_summary=columns_summary,
            findings=findings,
        )
