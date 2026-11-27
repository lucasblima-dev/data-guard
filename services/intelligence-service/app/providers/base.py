import json
import re
from abc import ABC, abstractmethod
from typing import Any

from app.schemas.report import KeyInsight, ReportLLMResponse

_THINK_BLOCK_RE = re.compile(r"<think>.*?</think>", flags=re.DOTALL | re.IGNORECASE)


def build_audit_context(
    row_count: int,
    column_count: int,
    columns_summary: dict[str, Any],
    findings: list[dict[str, Any]],
) -> dict[str, Any]:
    """Serializa apenas métricas agregadas e achados estruturados (nunca dados brutos do CSV)."""
    clean_findings = [
        {
            "code": str(item.get("code", "UNKNOWN")),
            "severity": str(item.get("severity", "info")),
            "target_column": item.get("target_column"),
            "description": str(item.get("description", "")),
            "metric_value": item.get("metric_value"),
            "evidence": item.get("evidence"),
        }
        for item in findings
    ]

    # Limita a quantidade de colunas serializadas no prompt caso o CSV seja muito largo
    capped_columns = dict(list(columns_summary.items())[:30])

    return {
        "dataset_overview": {
            "total_rows": row_count,
            "total_columns": column_count,
            "columns_included_in_context": len(capped_columns),
        },
        "columns_summary": capped_columns,
        "quality_findings": clean_findings,
    }


def build_json_system_prompt() -> str:
    return (
        "Você é um auditor sênior de qualidade e governança de dados. "
        "Analise exclusivamente os metadados estatísticos e achados determinísticos fornecidos "
        "(nunca invente métricas ou contagens ausentes nos dados) e responda ESTRITAMENTE "
        "em JSON puro válido, em português do Brasil, sem blocos markdown e sem texto fora do JSON, "
        "seguindo exatamente este schema:\n"
        "{\n"
        '  "executive_summary": "Resumo executivo técnico e objetivo em português sobre a saúde da base.",\n'
        '  "key_insights": [\n'
        "    {\n"
        '      "finding_code": "Mesmo valor exato do campo code presente em quality_findings (ex: DUPLICATE_ROWS, CRITICAL_NULL_RATE)",\n'
        '      "interpretation": "Interpretação técnica e de impacto de negócio do achado",\n'
        '      "suggested_action": "Ação prática recomendada para saneamento ou prevenção"\n'
        "    }\n"
        "  ],\n"
        '  "recommended_actions": ["Ação global prioritária 1", "Ação global prioritária 2"],\n'
        '  "limitations": ["Ressalva metodológica 1", "Ressalva metodológica 2"]\n'
        "}"
    )


def parse_llm_json_response(raw_text: str) -> ReportLLMResponse:
    """Extrai e valida o JSON retornado pelo modelo de linguagem de forma tolerante a ruídos de formatação."""
    cleaned = _THINK_BLOCK_RE.sub("", raw_text or "").strip()

    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise ValueError("A resposta do modelo não contém um objeto JSON válido.")
        parsed = json.loads(cleaned[start : end + 1])

    if not isinstance(parsed, dict):
        raise ValueError("A resposta JSON do modelo deve ser um objeto na raiz.")

    executive_summary = str(parsed.get("executive_summary", "")).strip()
    if not executive_summary:
        raise ValueError("O modelo retornou 'executive_summary' vazio.")

    insights: list[KeyInsight] = []
    raw_insights = parsed.get("key_insights") or []
    if isinstance(raw_insights, list):
        for item in raw_insights:
            if isinstance(item, dict):
                interpretation = str(item.get("interpretation", "")).strip()
                suggested_action = str(item.get("suggested_action", "")).strip()
                if interpretation or suggested_action:
                    insights.append(
                        KeyInsight(
                            finding_code=str(item.get("finding_code", "GENERAL")).strip() or "GENERAL",
                            interpretation=interpretation or "Inconformidade identificada na auditoria.",
                            suggested_action=suggested_action or "Revisar pipeline de origem dos dados.",
                        )
                    )

    raw_actions = parsed.get("recommended_actions") or []
    recommended_actions = (
        [str(a).strip() for a in raw_actions if str(a).strip()]
        if isinstance(raw_actions, list)
        else []
    )

    raw_limitations = parsed.get("limitations") or []
    limitations = (
        [str(lim).strip() for lim in raw_limitations if str(lim).strip()]
        if isinstance(raw_limitations, list)
        else []
    )

    return ReportLLMResponse(
        executive_summary=executive_summary,
        key_insights=insights,
        recommended_actions=recommended_actions,
        limitations=limitations,
    )


class BaseLLMProvider(ABC):
    @property
    @abstractmethod
    def provider_name(self) -> str:
        pass

    @abstractmethod
    async def generate_report_synthesis(
        self,
        row_count: int,
        column_count: int,
        columns_summary: dict[str, Any],
        findings: list[dict[str, Any]],
    ) -> tuple[ReportLLMResponse, str]:
        pass
