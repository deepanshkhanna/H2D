"""
Pydantic / SQLModel schemas — the single source of truth for all
data structures that flow through the pipeline and are served to the
frontend. Mirrors the JSON schema in Plan.md.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel, Field
from sqlmodel import Column, Field as SMField, SQLModel, Text


# ─── Enums ────────────────────────────────────────────────────────────────────

class DocumentType(str, enum.Enum):
    invoice_pdf = "invoice_pdf"
    complaint_email = "complaint_email"
    damage_image = "damage_image"
    unknown = "unknown"


class NodeType(str, enum.Enum):
    document = "document"
    entity = "entity"
    observation = "observation"
    anomaly = "anomaly"
    risk = "risk"
    action = "action"


class EdgeType(str, enum.Enum):
    contains = "contains"
    mentions = "mentions"
    same_as = "same_as"
    supports = "supports"
    contradicts = "contradicts"
    correlates_with = "correlates_with"
    causes_risk = "causes_risk"
    requires_review = "requires_review"


class EdgeStatus(str, enum.Enum):
    confirmed = "confirmed"
    probable = "probable"
    weak = "weak"
    rejected = "rejected"


class Severity(str, enum.Enum):
    none = "none"
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class RiskLabel(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class JobStatus(str, enum.Enum):
    queued = "queued"
    files_stored = "files_stored"
    invoice_parsed = "invoice_parsed"
    email_parsed = "email_parsed"
    image_analyzed = "image_analyzed"
    entities_extracted = "entities_extracted"
    entities_normalized = "entities_normalized"
    links_scored = "links_scored"
    risk_scored = "risk_scored"
    graph_generated = "graph_generated"
    completed = "completed"
    failed = "failed"


STAGE_PROGRESS: dict[JobStatus, int] = {
    JobStatus.queued: 0,
    JobStatus.files_stored: 8,
    JobStatus.invoice_parsed: 20,
    JobStatus.email_parsed: 30,
    JobStatus.image_analyzed: 42,
    JobStatus.entities_extracted: 56,
    JobStatus.entities_normalized: 65,
    JobStatus.links_scored: 75,
    JobStatus.risk_scored: 85,
    JobStatus.graph_generated: 95,
    JobStatus.completed: 100,
    JobStatus.failed: 100,
}


# ─── SQLite-backed job tables ─────────────────────────────────────────────────

class Job(SQLModel, table=True):
    __tablename__ = "jobs"

    id: str = SMField(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    incident_id: str = SMField(index=True)
    status: str = SMField(default=JobStatus.queued)
    stage: str = SMField(default=JobStatus.queued)
    progress: int = SMField(default=0)
    error: Optional[str] = None
    created_at: str = SMField(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = SMField(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class JobEvent(SQLModel, table=True):
    __tablename__ = "job_events"

    id: str = SMField(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    job_id: str = SMField(index=True)
    stage: str
    message: str
    payload_json: Optional[str] = SMField(default=None, sa_column=Column(Text))
    created_at: str = SMField(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class IncidentArtifact(SQLModel, table=True):
    __tablename__ = "incident_artifacts"

    id: str = SMField(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    incident_id: str = SMField(index=True)
    job_id: Optional[str] = SMField(default=None, index=True)
    artifact_kind: str = SMField(default="input")
    role: str = SMField(index=True)
    sha256: str = SMField(index=True)
    storage_backend: str = SMField(default="local")
    storage_path: str
    metadata_json: Optional[str] = SMField(default=None, sa_column=Column(Text))
    created_at: str = SMField(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ─── Pydantic response models ─────────────────────────────────────────────────

class JobEventResponse(BaseModel):
    id: str
    job_id: str
    stage: str
    message: str
    payload: Optional[dict[str, Any]] = None
    created_at: str


class JobResponse(BaseModel):
    id: str
    incident_id: str
    status: str
    stage: str
    progress: int
    error: Optional[str] = None
    events: list[JobEventResponse] = Field(default_factory=list)
    created_at: str
    updated_at: str


class CreateIncidentResponse(BaseModel):
    job_id: str
    incident_id: str
    status: str = "queued"


# ─── Evidence graph structures ────────────────────────────────────────────────

class SourceRef(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    document_id: str
    kind: str  # "text_span", "bbox", "email_header", "vision_label"
    page: Optional[int] = None
    text: str
    char_start: Optional[int] = None
    char_end: Optional[int] = None
    bbox: Optional[list[float]] = None
    hash: str


class ConfidenceComponents(BaseModel):
    identifier_score: float = 0.0
    party_score: float = 0.0
    temporal_score: float = 0.0
    semantic_damage_score: float = 0.0
    vision_text_score: float = 0.0
    model_adjudication_score: float = 0.0


class ConfidenceBreakdown(BaseModel):
    final: float
    threshold: float = 0.65
    decision: str  # "accept" | "warn" | "hide" | "reject"
    components: ConfidenceComponents
    weights: dict[str, float] = Field(default_factory=lambda: {
        "identifier_score": 0.40,
        "party_score": 0.15,
        "temporal_score": 0.10,
        "semantic_damage_score": 0.20,
        "vision_text_score": 0.10,
        "model_adjudication_score": 0.05,
    })
    calibration_note: str = ""


class VisualMeta(BaseModel):
    cluster: str = "default"
    rank: int = 0
    collapsed: bool = False
    icon: str = "circle"


class EvidenceNode(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: NodeType
    subtype: Optional[str] = None
    label: str
    description: Optional[str] = None
    confidence: float = 1.0
    severity: Optional[Severity] = None
    source_ref_ids: list[str] = Field(default_factory=list)
    data: dict[str, Any] = Field(default_factory=dict)
    visual: Optional[VisualMeta] = None


class EvidenceEdge(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source: str
    target: str
    type: EdgeType
    label: str
    confidence: float
    status: EdgeStatus
    evidence_ref_ids: list[str] = Field(default_factory=list)
    confidence_breakdown: Optional[ConfidenceBreakdown] = None
    explanation_id: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ModelCallRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    provider: str
    model: str
    purpose: str
    prompt_hash: str
    input_artifact_ids: list[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class GraphMetadata(BaseModel):
    incident_id: str
    job_id: str
    graph_version: str = "v1"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    input_hash: str = ""
    pipeline_versions: dict[str, str] = Field(default_factory=dict)
    model_calls: list[ModelCallRecord] = Field(default_factory=list)


class Explanation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    incident_id: str
    summary: str
    why: list[str] = Field(default_factory=list)
    uncertainty: list[str] = Field(default_factory=list)
    recommended_action: str = ""
    risk_score: float = 0.0
    risk_label: RiskLabel = RiskLabel.low


class EvidenceGraph(BaseModel):
    metadata: GraphMetadata
    nodes: list[EvidenceNode] = Field(default_factory=list)
    edges: list[EvidenceEdge] = Field(default_factory=list)
    source_refs: list[SourceRef] = Field(default_factory=list)
    explanations: list[Explanation] = Field(default_factory=list)
