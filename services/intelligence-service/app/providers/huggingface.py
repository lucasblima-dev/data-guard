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


class HuggingFaceProvider(BaseLLMProvider):
    @property
    def provider_name(self) -> str:
        return "huggingface"

    async def generate_report_synthesis(
        self,
        row_count: int,
        column_count: int,
        columns_summary: dict[str, Any],
        findings: list[dict[str, Any]],
    ) -> tuple[ReportLLMResponse, str]:
        if not settings.HF_TOKEN:
            raise ValueError(
                "HF_TOKEN não configurado ou ainda com valor de exemplo no .env."
            )

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

        headers = {
            "Authorization": f"Bearer {settings.HF_TOKEN}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": settings.HF_MODEL_ID,
            "messages": [
                {"role": "system", "content": build_json_system_prompt()},
                {"role": "user", "content": user_content},
            ],
            "max_tokens": 2048,
            "temperature": 0.2,
        }

        async with httpx.AsyncClient(timeout=settings.HF_TIMEOUT_SECONDS) as client:
            response = await client.post(settings.HF_API_URL, headers=headers, json=payload)

        if response.status_code in (401, 403):
            raise RuntimeError(
                f"Hugging Face API recusou autenticação/permissão (HTTP {response.status_code}). "
                "Verifique se o HF_TOKEN é válido e possui a permissão 'Make calls to Inference Providers'."
            )
        if response.status_code == 402:
            raise RuntimeError(
                "Hugging Face API retornou HTTP 402 (cota gratuita de créditos excedida na conta)."
            )
        if response.status_code == 429:
            raise RuntimeError("Hugging Face API sob Rate Limit (429).")
        if response.status_code == 503:
            raise RuntimeError("Hugging Face API indisponível / cold start (503).")
        if response.status_code != 200:
            raise RuntimeError(
                f"Erro na Hugging Face API: HTTP {response.status_code} - {response.text[:300]}"
            )

        data = response.json()

        generated_text = ""
        if isinstance(data, dict) and "choices" in data:
            choices = data.get("choices") or []
            if choices and isinstance(choices[0], dict):
                message = choices[0].get("message") or {}
                generated_text = str(message.get("content", ""))
        elif isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
            generated_text = str(data[0].get("generated_text", ""))
        elif isinstance(data, dict):
            generated_text = str(data.get("generated_text", ""))

        llm_response = parse_llm_json_response(generated_text)
        return llm_response, "llm_assisted"
