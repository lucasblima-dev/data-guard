from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class JobStatus(str, Enum):
    ENVIADA = "enviada"
    VALIDANDO = "validando"
    ANALISANDO = "analisando"
    GERANDO_RELATORIO = "gerando_relatorio"
    CONCLUIDA = "concluida"
    FALHOU = "falhou"


class JobCreate(BaseModel):
    original_filename: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Nome original do arquivo CSV submetido.",
        examples=["vendas_2026.csv"],
    )
    file_size_bytes: int | None = Field(
        default=None,
        ge=0,
        description="Tamanho do arquivo em bytes.",
        examples=[1048576],
    )
    file_ref: str | None = Field(
        default=None,
        max_length=512,
        description="Caminho ou identificador seguro do arquivo no storage.",
        examples=["/app/storage/vendas_2026_uuid.csv"],
    )


class JobUpdate(BaseModel):
    status: JobStatus | None = Field(
        default=None,
        description="Novo status do ciclo de vida da análise.",
    )
    error_code: str | None = Field(
        default=None,
        max_length=100,
        description="Código padronizado de erro, caso a análise tenha falhado.",
    )
    error_message: str | None = Field(
        default=None,
        description="Mensagem descritiva e segura do erro para exibição ao usuário.",
    )
    completed_at: datetime | None = Field(
        default=None,
        description="Instante de conclusão do processamento.",
    )


class JobResponse(BaseModel):
    id: UUID = Field(..., description="Identificador único universal da análise.")
    original_filename: str = Field(..., description="Nome do arquivo analisado.")
    file_size_bytes: int | None = Field(default=None, description="Tamanho em bytes.")
    file_ref: str | None = Field(default=None, description="Referência do arquivo.")
    status: JobStatus = Field(..., description="Status atual do processamento.")
    error_code: str | None = Field(default=None, description="Código de erro.")
    error_message: str | None = Field(default=None, description="Mensagem de erro.")
    created_at: datetime = Field(..., description="Data e hora de criação.")
    updated_at: datetime = Field(..., description="Data e hora da última atualização.")
    completed_at: datetime | None = Field(default=None, description="Data e hora de conclusão.")

    model_config = ConfigDict(from_attributes=True)


class JobListResponse(BaseModel):
    items: list[JobResponse] = Field(..., description="Lista de jobs na página atual.")
    total: int = Field(..., ge=0, description="Total geral de registros correspondentes.")
    page: int = Field(..., ge=1, description="Número da página atual.")
    page_size: int = Field(..., ge=1, description="Quantidade de registros por página.")
    total_pages: int = Field(..., ge=0, description="Quantidade total de páginas.")
