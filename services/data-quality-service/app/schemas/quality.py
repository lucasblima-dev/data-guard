from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProcessQualityRequest(BaseModel):
    analysis_id: UUID = Field(..., description="ID universal da análise solicitada.")
    filename: str = Field(..., description="Nome original do arquivo CSV.")
    file_ref: str | None = Field(default=None, description="Caminho seguro do arquivo no storage.")


class ProcessQualityResponse(BaseModel):
    analysis_id: UUID = Field(..., description="ID da análise processada.")
    status: str = Field(..., description="Status do resultado do processamento.")
    message: str = Field(..., description="Mensagem descritiva do resultado.")
    profile_id: UUID | None = Field(default=None, description="ID do perfil gerado.")
    findings_count: int = Field(default=0, description="Quantidade de achados de qualidade identificados.")


class ColumnSummary(BaseModel):
    data_type: str = Field(..., description="Tipo inferido da coluna (numeric, categorical, temporal, textual).")
    total_count: int = Field(..., description="Contagem total de registros.")
    null_count: int = Field(..., description="Quantidade de valores nulos.")
    null_percentage: float = Field(..., description="Percentual de valores nulos.")
    unique_count: int = Field(..., description="Quantidade de valores distintos/únicos.")
    mean: float | None = Field(default=None, description="Média aritmética (colunas numéricas).")
    std_dev: float | None = Field(default=None, description="Desvio padrão (colunas numéricas).")
    min_value: Any | None = Field(default=None, description="Menor valor da coluna.")
    q25: float | None = Field(default=None, description="Primeiro quartil (25%).")
    median: float | None = Field(default=None, description="Mediana (50%).")
    q75: float | None = Field(default=None, description="Terceiro quartil (75%).")
    max_value: Any | None = Field(default=None, description="Maior valor da coluna.")
    top_categories: list[dict[str, Any]] | None = Field(
        default=None,
        description="Categorias mais frequentes e suas contagens.",
    )


class DatasetProfileResponse(BaseModel):
    id: UUID = Field(..., description="ID do perfil gerado.")
    analysis_id: UUID = Field(..., description="ID da análise correspondente.")
    row_count: int = Field(..., description="Total de linhas válidas.")
    column_count: int = Field(..., description="Total de colunas.")
    columns_summary: dict[str, Any] = Field(..., description="Resumo estatístico por coluna.")
    generated_at: datetime = Field(..., description="Data e hora de geração do perfil.")

    model_config = ConfigDict(from_attributes=True)


class QualityFindingResponse(BaseModel):
    id: UUID = Field(..., description="ID do achado de qualidade.")
    analysis_id: UUID = Field(..., description="ID da análise correspondente.")
    code: str = Field(..., description="Código padronizado do achado (ex: DUPLICATE_ROWS).")
    severity: str = Field(..., description="Severidade: info, warning ou critical.")
    target_column: str | None = Field(default=None, description="Coluna afetada, se aplicável.")
    description: str = Field(..., description="Descrição técnica do achado.")
    metric_value: float | None = Field(default=None, description="Valor numérico relacionado à métrica.")
    evidence: str | None = Field(default=None, description="Evidência textual de amostragem.")
    created_at: datetime = Field(..., description="Data e hora do registro do achado.")

    model_config = ConfigDict(from_attributes=True)


class QualityDetailsResponse(BaseModel):
    analysis_id: UUID = Field(..., description="ID da análise.")
    profile: DatasetProfileResponse | None = Field(default=None, description="Perfil estatístico do dataset.")
    findings: list[QualityFindingResponse] = Field(default_factory=list, description="Lista de achados de qualidade.")
