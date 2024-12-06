from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator
import uuid

# see .cursorrules for the schema


# graph_nodes table contains:
class ContentMapNode(BaseModel):
    id: str = Field(default_factory=lambda: f"node_{uuid.uuid4().hex}", alias="id")
    summary: str
    content: str
    supporting_quotes: list[str]
    order_index: int

    class Config:
        allow_population_by_field_name = True
        use_enum_values = True
        json_encoders = {uuid.UUID: str}


class ContentMapEdgePreID(BaseModel):
    parent_index: int
    child_index: int


# NOTE: parent_index and child_index have to be converted to parent_id and child_id
# (this happens in prompts.py)
# also: the .id on ContentMapNode has to be converted into an actual id
class ContentMapEdge(BaseModel):
    # this is what graph_edges table contains
    parent_id: str
    child_id: str
    graph_id: str | None = None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


#
# LEARNING PROGRESS
#


REVIEW_QUALITY_LABEL = Literal["failed", "hard", "good", "easy"]


class LearningProgressUpdateData(BaseModel):
    quality: REVIEW_QUALITY_LABEL
    notes: Optional[str] = None


class SpacedRepState(BaseModel):
    next_review: Optional[datetime] = None
    last_review: Optional[datetime] = None
    current_interval: float = Field(default=0)  # Days
    ease_factor: float = Field(default=2.5)
    review_history: list[tuple[datetime, LearningProgressUpdateData]] = Field(
        default_factory=list
    )

    # Add this to handle datetime strings from JSON
    model_config = ConfigDict(
        json_encoders={datetime: lambda v: v.isoformat()}, populate_by_name=True
    )


# this is what the learning_progress table contains
class LearningProgress(BaseModel):
    id: uuid.UUID  # Changed from str to UUID
    user_id: uuid.UUID
    node_id: str
    graph_id: uuid.UUID
    version: int | None = None
    spaced_rep_state: SpacedRepState
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    # Add this validator to handle the JSONB -> SpacedRepState conversion
    @field_validator("spaced_rep_state", mode="before")
    @classmethod
    def parse_spaced_rep_state(cls, value):
        if isinstance(value, dict):
            return SpacedRepState.model_validate(value)
        return value


# this is what the learning_progress_updates table contains
class LearningProgressUpdate(BaseModel):
    learning_progress_id: str  # which node in the knowledge graph this is about
    message_id: str  # which message in the chat triggered this learning update
    created_at: datetime  # when this happened
    spaced_rep_state: SpacedRepState
    update_data: LearningProgressUpdateData

    model_config = ConfigDict(from_attributes=True)


# this is what the frontend actually sends; gets converted into the above by looking up SpacedRepState
class LearningProgressUpdateRequest(BaseModel):
    learning_progress_id: str  # which node in the knowledge graph this is about
    message_id: str  # which message in the chat triggered this learning update
    created_at: datetime  # when this happened
    update_data: LearningProgressUpdateData
