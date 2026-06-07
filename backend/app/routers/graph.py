"""
GET /api/incidents/{incident_id}/graph  — full EvidenceGraph JSON (read-only, no auth)
GET /api/incidents/{incident_id}/audit  — same structure (read-only, no auth)
"""

from __future__ import annotations
import json

from fastapi import APIRouter, HTTPException
from app.models import EvidenceGraph
from app.storage import read_incident_json

router = APIRouter(prefix="/api/incidents", tags=["graph"])


@router.get("/{incident_id}/graph", response_model=EvidenceGraph)
def get_graph(incident_id: str):
    raw = read_incident_json(incident_id, "graph.v1.json")
    if raw is None:
        raise HTTPException(
            status_code=404,
            detail="Graph not yet available. Poll /api/jobs/{job_id} for status.",
        )
    return EvidenceGraph.model_validate(json.loads(raw))


@router.get("/{incident_id}/audit", response_model=EvidenceGraph)
def get_audit(incident_id: str):
    raw = read_incident_json(incident_id, "audit.v1.json")
    if raw is None:
        # Fall back to main graph
        raw = read_incident_json(incident_id, "graph.v1.json")
    if raw is None:
        raise HTTPException(status_code=404, detail="Audit not yet available.")
    return EvidenceGraph.model_validate(json.loads(raw))
