import json
import logging
from typing import Any

import httpx

from app.config import settings
from app.providers.base import BaseLLMProvider
from app.schemas.report import KeyInsight, ReportLLMResponse

logger = logging.getLogger(__name__)


class HuggingFaceProvider(BaseLLMProvider):
    @property
    def provider_name(self) -> str:
        return "huggingface"

    def _build_prompt(
        self,
        row_count: int,
        column_count: int,
        columns_summary: dict[str, Any],
        findings: list[dict[str, Any]],
    ) -> str:
        data_context = {
            "dataset_overview": {
                "total_rows": row_count,
                "total_columns": column_count,
            },
            "columns_summary": columns_summary,
            "quality_findings": findings,
        }

        return (
            "Você é um auditor sênior de qualidade e governança de dados. "
            "Analise os metadados e achados técnicos abaixo e responda ESTRITAMENTE em formato JSON puro, "
            "sem blocos de markdown adicionais, no seguinte formato:\n"
            "{\n"
            '  "executive_summary": "resumo executivo claro e formal em português",\n'
            '  "key_insights": [\n'
            "    {\n"
            '      "finding_code": "código do achado",\n'
            '      "interpretation": "interpretação do impacto técnico e de negócio",\n'
            '      "suggested_action": "ação de correção recomendada"\n'
            "    }\n"
            "  ],\n"
            '  "recommended_actions": ["ação 1", "ação 2"],\n'
            '  "limitations": ["limitação 1", "limitação 2"]\n'
            "}\n\n"
            f"DADOS DE AUDITORIA:\n{json.dumps(data_context, ensure_ascii=False)}"
        )

    async def generate_report_synthesis(
        self,
        row_count: int,
        column_count: int,
        columns_summary: dict[str, Any],
        findings: list[dict[str, Any]],
    ) -> tuple[ReportLLMResponse, str]:
        if not settings.HF_TOKEN:
            raise ValueError("HF_TOKEN não configurado no ambiente.")

        prompt = self._build_prompt(row_count, column_count, columns_summary, findings)
        url = f"https://api-inference.huggingface.co/models/{settings.HF_MODEL_ID}"
        headers = {
            "Authorization": f"Bearer {settings.HF_TOKEN}",
            "Content-Type": "application/json",
        }
        payload = {
            "inputs": prompt,
            "parameters": {
                "max_new_tokens": 1024,
                "temperature": 0.2,
                "return_full_text": False,
            },
        }

        async with httpx.AsyncClient(timeout=settings.HF_TIMEOUT_SECONDS) as client:
            response = await client.post(url, headers=headers, json=payload)

            if response.status_code == 429:
                raise RuntimeError("Hugging Face API sob Rate Limit (429).")
            if response.status_code == 503:
                raise RuntimeError("Hugging Face API em cold start (503).")
            if response.status_code != 200:
                raise RuntimeError(
                    f"Erro na Hugging Face API: HTTP {response.status_code} - {response.text}"
                )

            data = response.json()

            # Extração de texto gerado
            generated_text = ""
            if isinstance(data, list) and len(data) > 0:
                generated_text = data[0].get("generated_text", "")
            elif isinstance(data, dict):
                generated_text = data.get("generated_text", "")

            # Sanitização de possíveis blocos ```json ... ```
            clean_text = generated_text.strip()
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
