from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.job import JobResponse


class DatasetProfileSchema(BaseModel):
    id: UUID
    analysis_id: UUID
    row_count: int
    column_count: int
    columns_summary: dict[str, Any]
    generated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class QualityFindingSchema(BaseModel):
    id: UUID
    analysis_id: UUID
    code: str
    severity: Literal["info", "warning", "critical"]
    target_column: str | None = None
    description: str
    metric_value: float | None = None
    evidence: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class KeyInsightSchema(BaseModel):
    finding_code: str
    interpretation: str
    suggested_action: str


class QualityReportSchema(BaseModel):
    id: UUID
    analysis_id: UUID
    executive_summary: str
    key_insights: list[KeyInsightSchema] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    generation_mode: Literal["llm_assisted", "rules_only"]
    generated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FullAnalysisDetailsResponse(BaseModel):
    job: JobResponse
    profile: DatasetProfileSchema | None = None
    findings: list[QualityFindingSchema] = Field(default_factory=list)
    report: QualityReportSchema | None = None
    health_score: int | None = Field(default=None, ge=0, le=100)
