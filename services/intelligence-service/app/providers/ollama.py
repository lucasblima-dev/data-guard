import json
import logging
from typing import Any

import httpx

from app.config import settings
from app.providers.base import (
    BaseLLMProvider,
    build_audit_context,
    build_json_system_prompt,
    parse_llm_json_response,
)
from app.schemas.report import ReportLLMResponse

logger = logging.getLogger(__name__)


class OllamaProvider(BaseLLMProvider):
    @property
    def provider_name(self) -> str:
        return "ollama"

    async def generate_report_synthesis(
        self,
        row_count: int,
        column_count: int,
        columns_summary: dict[str, Any],
        findings: list[dict[str, Any]],
    ) -> tuple[ReportLLMResponse, str]:
        data_context = build_audit_context(
            row_count=row_count,
            column_count=column_count,
            columns_summary=columns_summary,
            findings=findings,
        )

        user_content = (
            "Avalie os metadados e achados de qualidade abaixo e produza o laudo JSON:\n"
            f"{json.dumps(data_context, ensure_ascii=False)}"
        )

        url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/chat"
        payload = {
            "model": settings.OLLAMA_MODEL,
            "messages": [
                {"role": "system", "content": build_json_system_prompt()},
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
                f"Erro na API do Ollama ({url}): HTTP {response.status_code} - {response.text[:300]}"
            )

        data = response.json()
        message_content = str(data.get("message", {}).get("content", ""))

        llm_response = parse_llm_json_response(message_content)
        return llm_response, "llm_assisted"
