from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProcessQualityRequest(BaseModel):
    analysis_id: UUID = Field(..., description="ID universal da análise solicitada.")
    filename: str = Field(..., description="Nome original do arquivo CSV.")
    file_ref: str | None = Field(default=None, description="Caminho seguro do arquivo no storage.")
    csv_content: str | None = Field(default=None, description="Conteúdo textual do CSV para ambientes em nuvem com sistemas de arquivos isolados.")


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
    id: UUID = Field(..., description="Identificador único do achado.")
    analysis_id: UUID = Field(..., description="ID da análise à qual o achado pertence.")
    code: str = Field(..., description="Código de categorização da anomalia identificada.")
    severity: str = Field(..., description="Nível de severidade do achado (critical, warning, info).")
    target_column: str | None = Field(default=None, description="Nome do atributo afetado.")
    description: str = Field(..., description="Detalhamento textual explicativo do problema.")
    metric_value: float | None = Field(default=None, description="Valor quantitativo da métrica de qualidade.")
    evidence: str | None = Field(default=None, description="Dados amostrais que fundamentam o achado.")
    created_at: datetime = Field(..., description="Timestamp de detecção do achado.")

    model_config = ConfigDict(from_attributes=True)


class QualityDetailsResponse(BaseModel):
    analysis_id: UUID = Field(..., description="ID da análise consultada.")
    profile: DatasetProfileResponse | None = Field(default=None, description="Perfil descritivo tabular.")
    findings: list[QualityFindingResponse] = Field(default_factory=list, description="Lista de achados de conformidade.")
