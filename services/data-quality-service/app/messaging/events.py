from datetime import datetime, timezone
from typing import Any, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

class EventEnvelope(BaseModel):
    event_id: UUID = Field(default_factory=uuid4)
    event_type: str
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    version: int = 1
    correlation_id: UUID
    payload: dict[str, Any]


class AnalysisRequestedPayload(BaseModel):
    analysis_id: UUID
    file_ref: str = Field(..., min_length=1)
    filename: str = Field(..., min_length=1)

class QualityStartedPayload(BaseModel):
    analysis_id: UUID

class QualityCompletedPayload(BaseModel):
    analysis_id: UUID
    profile_id: UUID
    findings_count: int = Field(..., ge=0)

class AnalysisFailedPayload(BaseModel):
    analysis_id: UUID
    stage: Literal["quality", "intelligence"]
    error_code: str
    error_message: str

def build_event(
    event_type: str,
    correlation_id: UUID,
    payload: BaseModel,
) -> EventEnvelope:
    return EventEnvelope(
        event_id=uuid4(),
        event_type=event_type,
        occurred_at=datetime.now(timezone.utc),
        version=1,
        correlation_id=correlation_id,
        payload=payload.model_dump(mode="json"),
    )
