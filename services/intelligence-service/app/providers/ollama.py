import json
import logging
from typing import Any

import httpx

from app.config import settings
from app.providers.base import BaseLLMProvider
from app.schemas.report import KeyInsight, ReportLLMResponse

logger = logging.getLogger(__name__)


class OllamaProvider(BaseLLMProvider):
    @property
    def provider_name(self) -> str:
        return "ollama"

    def _build_system_prompt(self) -> str:
        return (
            "Você é um auditor e cientista de dados sênior especializado em conformidade e qualidade. "
            "Sua resposta deve ser estritamente em JSON puro com as chaves: "
            "'executive_summary', 'key_insights', 'recommended_actions', 'limitations'. "
            "Não adicione nenhum texto introdutório ou conclusivo fora do JSON."
        )

    async def generate_report_synthesis(
        self,
        row_count: int,
        column_count: int,
        columns_summary: dict[str, Any],
        findings: list[dict[str, Any]],
    ) -> tuple[ReportLLMResponse, str]:
        data_context = {
            "dataset_overview": {
                "total_rows": row_count,
                "total_columns": column_count,
            },
            "columns_summary": columns_summary,
            "quality_findings": findings,
        }

        user_content = (
            f"Avalie a qualidade do dataset a seguir e produza o diagnóstico:\n"
            f"{json.dumps(data_context, ensure_ascii=False)}"
        )

        url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/chat"
        payload = {
            "model": settings.OLLAMA_MODEL,
            "messages": [
                {"role": "system", "content": self._build_system_prompt()},
                {"role": "user", "content": user_content},
            ],
            "format": "json",
            "stream": False,
            "options": {
                "temperature": 0.2,
            },
        }

        async with httpx.AsyncClient(timeout=settings.OLLAMA_TIMEOUT_SECONDS) as client:
            response = await client.post(url, json=payload)

            if response.status_code != 200:
                raise RuntimeError(
                    f"Erro na API do Ollama: HTTP {response.status_code} - {response.text}"
                )

            data = response.json()
            message_content = data.get("message", {}).get("content", "")

            # Sanitização de blocos markdown
            clean_text = message_content.strip()
            if clean_text.startswith("```json"):
                clean_text = clean_text[7:]
            if clean_text.startswith("```"):
                clean_text = clean_text[3:]
            if clean_text.endswith("```"):
                clean_text = clean_text[:-3]
            clean_text = clean_text.strip()

            parsed = json.loads(clean_text)

            insights = [
                KeyInsight(
                    finding_code=str(item.get("finding_code", "UNKNOWN")),
                    interpretation=str(item.get("interpretation", "")),
                    suggested_action=str(item.get("suggested_action", "")),
                )
                for item in parsed.get("key_insights", [])
            ]

            llm_response = ReportLLMResponse(
                executive_summary=str(parsed.get("executive_summary", "")),
                key_insights=insights,
                recommended_actions=[str(a) for a in parsed.get("recommended_actions", [])],
                limitations=[str(l) for l in parsed.get("limitations", [])],
            )

            return llm_response, "llm_assisted"
