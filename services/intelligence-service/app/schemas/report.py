from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class KeyInsight(BaseModel):
    finding_code: str = Field(..., description="Código do achado relacionado (ex: DUPLICATE_ROWS).")
    interpretation: str = Field(..., description="Interpretação técnica e contextual do problema.")
    suggested_action: str = Field(..., description="Ação recomendada para correção ou mitigação.")


class ReportLLMResponse(BaseModel):
    executive_summary: str = Field(..., description="Resumo executivo do estado de qualidade do dataset.")
    key_insights: list[KeyInsight] = Field(default_factory=list, description="Lista de insights contextualizados.")
    recommended_actions: list[str] = Field(
        default_factory=list,
        description="Ações globais recomendadas para governança dos dados.",
    )
    limitations: list[str] = Field(
        default_factory=list,
        description="Ressalvas e limitações metodológicas identificadas.",
    )


class SynthesizeReportRequest(BaseModel):
    analysis_id: UUID = Field(..., description="ID universal da análise.")
    row_count: int = Field(default=0, ge=0, description="Total de linhas da base.")
    column_count: int = Field(default=0, ge=0, description="Total de atributos da base.")
    columns_summary: dict[str, Any] = Field(
        default_factory=dict,
        description="Resumo descritivo gerado pelo data-quality-service.",
    )
    findings: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Lista de achados gerados pelo data-quality-service.",
    )


class SynthesizeReportResponse(BaseModel):
    analysis_id: UUID = Field(..., description="ID da análise correspondente.")
    report_id: UUID = Field(..., description="ID do relatório gerado.")
    status: str = Field(..., description="Status da síntese (ex: completed).")
    generation_mode: str = Field(..., description="Modo de geração: llm_assisted ou rules_only.")


class AnalysisReportResponse(BaseModel):
    id: UUID = Field(..., description="ID do relatório.")
    analysis_id: UUID = Field(..., description="ID da análise correspondente.")
    executive_summary: str = Field(..., description="Resumo executivo consolidado.")
    key_insights: list[KeyInsight] = Field(..., description="Insights técnicos interpretados.")
    recommended_actions: list[str] = Field(..., description="Ações recomendadas de governança.")
    limitations: list[str] = Field(..., description="Limitações e ressalvas do dataset.")
    generation_mode: str = Field(..., description="Modo de geração empregado.")
    generated_at: datetime = Field(..., description="Data e hora de emissão do laudo.")

    model_config = ConfigDict(from_attributes=True)
