"""GET /api/jobs/{job_id} — returns current status + events."""

from __future__ import annotations
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.models import Job, JobEvent, JobResponse, JobEventResponse

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("/{job_id}", response_model=JobResponse)
def get_job(job_id: str, session: Session = Depends(get_session)):
    job = session.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    events = session.exec(
        select(JobEvent)
        .where(JobEvent.job_id == job_id)
        .order_by(JobEvent.created_at)
    ).all()

    event_responses = [
        JobEventResponse(
            id=ev.id,
            job_id=ev.job_id,
            stage=ev.stage,
            message=ev.message,
            payload=json.loads(ev.payload_json) if ev.payload_json else None,
            created_at=ev.created_at,
        )
        for ev in events
    ]

    return JobResponse(
        id=job.id,
        incident_id=job.incident_id,
        status=job.status,
        stage=job.stage,
        progress=job.progress,
        error=job.error,
        events=event_responses,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )
