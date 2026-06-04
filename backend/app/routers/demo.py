"""
Demo endpoint — loads the static demo graph for instant presentation.

GET /api/demo/graph → returns the pre-built demo graph JSON
POST /api/demo/load → copies demo files into storage and creates a completed job
"""

from __future__ import annotations

import json
import uuid
from pathlib import Path
from datetime import datetime, timezone

from fastapi import APIRouter
from sqlmodel import Session

from app.database import get_engine
from app.models import Job, JobEvent, JobStatus, STAGE_PROGRESS, EvidenceGraph
from app.storage import write_incident_json

router = APIRouter(prefix="/api/demo", tags=["demo"])

DEMO_GRAPH_PATH = Path(__file__).parent.parent.parent.parent / "demo" / "demo_graph.json"


@router.get("/graph", response_model=EvidenceGraph)
def get_demo_graph():
    """Return the static demo graph directly."""
    raw = DEMO_GRAPH_PATH.read_text(encoding="utf-8")
    return EvidenceGraph.model_validate(json.loads(raw))


@router.post("/load")
def load_demo() -> dict:
    """
    Instantiate the demo as a completed job so the normal polling UI
    picks it up. Returns {job_id, incident_id}.
    """
    incident_id = "demo-incident-001"
    job_id = str(uuid.uuid4())

    raw = DEMO_GRAPH_PATH.read_text(encoding="utf-8")
    write_incident_json(incident_id, "graph.v1.json", raw)
    write_incident_json(incident_id, "audit.v1.json", raw)

    with Session(get_engine()) as session:
        job = Job(
            id=job_id,
            incident_id=incident_id,
            status=JobStatus.completed,
            stage=JobStatus.completed,
            progress=100,
        )
        session.add(job)
        for stage in JobStatus:
            if stage == JobStatus.failed:
                continue
            session.add(JobEvent(
                job_id=job_id,
                stage=stage,
                message=f"Demo: {stage.value} complete",
            ))
        session.commit()

    return {"job_id": job_id, "incident_id": incident_id, "status": "completed"}
