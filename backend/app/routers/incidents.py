"""
POST /api/incidents — accepts multipart upload of up to 3 files,
                      stores them, creates job record, launches pipeline.
"""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, File, UploadFile, Depends, HTTPException
from sqlmodel import Session

from app.database import get_session
from app.models import (
    Job,
    JobStatus,
    CreateIncidentResponse,
    STAGE_PROGRESS,
)
from app.storage import store_upload
from app.pipeline import orchestrator

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


@router.post("", response_model=CreateIncidentResponse, status_code=202)
async def create_incident(
    invoice_pdf: Optional[UploadFile] = File(None),
    complaint_email: Optional[UploadFile] = File(None),
    damage_image: Optional[UploadFile] = File(None),
    session: Session = Depends(get_session),
):
    files_provided = [f for f in [invoice_pdf, complaint_email, damage_image] if f is not None]
    if not files_provided:
        raise HTTPException(status_code=422, detail="At least one file is required.")

    incident_id = str(uuid.uuid4())
    job = Job(
        incident_id=incident_id,
        status=JobStatus.queued,
        stage=JobStatus.queued,
        progress=STAGE_PROGRESS[JobStatus.queued],
    )
    session.add(job)
    session.commit()
    session.refresh(job)

    # Store uploaded bytes
    stored: dict[str, tuple[str, str]] = {}  # role → (sha256, path_str)
    for upload, role in [
        (invoice_pdf, "invoice_pdf"),
        (complaint_email, "complaint_email"),
        (damage_image, "damage_image"),
    ]:
        if upload is not None:
            data = await upload.read()
            sha, path = store_upload(data, upload.filename or f"{role}.bin")
            stored[role] = (sha, str(path))

    # Launch async pipeline (fire-and-forget via asyncio task)
    import asyncio
    asyncio.create_task(
        orchestrator.run_pipeline(job.id, incident_id, stored)
    )

    return CreateIncidentResponse(
        job_id=job.id,
        incident_id=incident_id,
        status="queued",
    )
