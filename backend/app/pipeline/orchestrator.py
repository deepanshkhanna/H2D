"""
Async pipeline orchestrator.
Each stage is awaited in sequence; if any stage fails the job is marked
failed and the error is persisted. Each stage emits an event.
Stages that call external APIs are wrapped with timeout controls to prevent
indefinite hangs and DoS scenarios.
"""

from __future__ import annotations

import asyncio
import json
import logging
import traceback
from datetime import datetime, timezone

from sqlmodel import Session, select

from app.database import get_engine
from app.models import IncidentArtifact, Job, JobEvent, JobStatus, STAGE_PROGRESS
from app.storage import write_incident_json

logger = logging.getLogger(__name__)

# Stage timeouts (seconds) — external API calls have longer timeouts
TIMEOUT_EXTERNAL_API = 60  # Gemini image analysis
TIMEOUT_LOCAL_PARSE = 30   # PDF/email parsing
TIMEOUT_DB_OPERATION = 10  # Database operations


def enqueue_pipeline(job_id: str, incident_id: str, stored_files: dict[str, tuple[str, str]]) -> None:
    """Schedule async pipeline execution when an event loop is available."""
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(run_pipeline(job_id, incident_id, stored_files))
    except RuntimeError:
        # Recovery/tests may run without a live loop; caller can monkeypatch this.
        return


def recover_unfinished_jobs() -> int:
    """Re-queue unfinished jobs by reconstructing stored file references from artifacts."""
    resumed = 0
    with Session(get_engine()) as session:
        pending = session.exec(
            select(Job).where(Job.status.notin_([JobStatus.completed, JobStatus.failed]))
        ).all()

        for job in pending:
            artifacts = session.exec(
                select(IncidentArtifact).where(IncidentArtifact.job_id == job.id)
            ).all()

            stored_files: dict[str, tuple[str, str]] = {}
            for art in artifacts:
                if art.role and art.sha256 and art.storage_path:
                    stored_files[art.role] = (art.sha256, art.storage_path)

            job.status = JobStatus.queued
            job.stage = JobStatus.queued
            job.progress = STAGE_PROGRESS[JobStatus.queued]
            job.updated_at = datetime.now(timezone.utc)
            session.add(job)
            session.add(
                JobEvent(
                    job_id=job.id,
                    stage=JobStatus.queued,
                    message="Recovered job after restart",
                    payload_json=json.dumps({"recovered_roles": list(stored_files.keys())}),
                )
            )

            enqueue_pipeline(job.id, job.incident_id, stored_files)
            resumed += 1

        session.commit()

    return resumed


# ─── DB helpers (sync, called inside async via run_in_executor) ────────────────

def _advance_job(job_id: str, stage: JobStatus, message: str, payload: dict | None = None):
    with Session(get_engine()) as session:
        job = session.get(Job, job_id)
        if not job:
            return
        job.stage = stage
        job.status = stage
        job.progress = STAGE_PROGRESS[stage]
        job.updated_at = datetime.now(timezone.utc)
        session.add(job)

        event = JobEvent(
            job_id=job_id,
            stage=stage,
            message=message,
            payload_json=json.dumps(payload) if payload else None,
        )
        session.add(event)
        session.commit()


def _fail_job(job_id: str, stage: JobStatus, error: str):
    with Session(get_engine()) as session:
        job = session.get(Job, job_id)
        if not job:
            return
        job.status = JobStatus.failed
        job.stage = stage
        job.error = error[:2000]
        job.updated_at = datetime.now(timezone.utc)
        session.add(job)

        event = JobEvent(
            job_id=job_id,
            stage=JobStatus.failed,
            message=f"Pipeline failed at {stage}: {error[:500]}",
        )
        session.add(event)
        session.commit()


# ─── Pipeline entry point ──────────────────────────────────────────────────────

async def run_pipeline(
    job_id: str,
    incident_id: str,
    stored_files: dict[str, tuple[str, str]],  # role → (sha256, path_str)
):
    """
    Runs the full pipeline in an asyncio task.
    stored_files keys: "invoice_pdf", "complaint_email", "damage_image"
    """
    loop = asyncio.get_event_loop()

    def advance(stage: JobStatus, msg: str, payload: dict | None = None):
        loop.run_in_executor(None, _advance_job, job_id, stage, msg, payload)

    def fail(stage: JobStatus, err: str):
        loop.run_in_executor(None, _fail_job, job_id, stage, err)

    try:
        # ── Stage 1: files stored ───────────────────────────────────────────
        _advance_job(job_id, JobStatus.files_stored, f"Stored {len(stored_files)} file(s)", {"roles": list(stored_files.keys())})
        await asyncio.sleep(0.1)

        # ── Stage 2-4: parse documents ──────────────────────────────────────
        from app.pipeline import parsers

        parsed: dict[str, dict] = {}

        if "invoice_pdf" in stored_files:
            sha, path = stored_files["invoice_pdf"]
            result = await asyncio.get_event_loop().run_in_executor(
                None, parsers.parse_pdf, path, incident_id
            )
            parsed["invoice_pdf"] = result
            _advance_job(job_id, JobStatus.invoice_parsed,
                         f"Invoice parsed: {result.get('page_count', '?')} pages, {len(result.get('text', ''))} chars",
                         {"sha": sha})

        if "complaint_email" in stored_files:
            _, path = stored_files["complaint_email"]
            result = await asyncio.get_event_loop().run_in_executor(
                None, parsers.parse_email, path, incident_id
            )
            parsed["complaint_email"] = result
            _advance_job(job_id, JobStatus.email_parsed,
                         f"Email parsed: subject='{result.get('subject', '')[:60]}'")

        if "damage_image" in stored_files:
            _, path = stored_files["damage_image"]
            from app.ai import gemini
            try:
                result = await asyncio.wait_for(
                    asyncio.get_event_loop().run_in_executor(
                        None, gemini.analyze_damage_image, path, incident_id
                    ),
                    timeout=TIMEOUT_EXTERNAL_API
                )
            except asyncio.TimeoutError:
                raise RuntimeError(f"Image analysis timed out after {TIMEOUT_EXTERNAL_API}s")
            parsed["damage_image"] = result
            _advance_job(job_id, JobStatus.image_analyzed,
                         f"Image analyzed: {len(result.get('labels', []))} damage labels detected")

        # ── Stage 5: entity extraction ──────────────────────────────────────
        from app.pipeline import extractor
        entities = await asyncio.get_event_loop().run_in_executor(
            None, extractor.extract_entities, parsed, incident_id
        )
        _advance_job(job_id, JobStatus.entities_extracted,
                     f"Extracted {len(entities.get('mentions', []))} entity mentions",
                     {"mention_count": len(entities.get("mentions", []))})

        # ── Stage 6: entity normalization ───────────────────────────────────
        from app.pipeline import normalizer
        canonical = await asyncio.get_event_loop().run_in_executor(
            None, normalizer.normalize_entities, entities, incident_id
        )
        _advance_job(job_id, JobStatus.entities_normalized,
                     f"Normalized to {len(canonical.get('canonical', []))} canonical entities")

        # ── Stage 7: link scoring ────────────────────────────────────────────
        from app.pipeline import correlator
        links = await asyncio.get_event_loop().run_in_executor(
            None, correlator.score_links, canonical, parsed, incident_id
        )
        _advance_job(job_id, JobStatus.links_scored,
                     f"Scored {len(links.get('edges', []))} candidate links",
                     {"confirmed": links.get("confirmed_count", 0)})

        # ── Stage 8: risk scoring ────────────────────────────────────────────
        from app.pipeline import risk as risk_mod
        risk_data = await asyncio.get_event_loop().run_in_executor(
            None, risk_mod.score_risk, links, canonical, parsed, incident_id
        )
        _advance_job(job_id, JobStatus.risk_scored,
                     f"Risk score: {risk_data.get('risk_score', 0):.0f}/100 ({risk_data.get('risk_label', 'unknown')})")

        # ── Stage 9: graph construction ──────────────────────────────────────
        from app.pipeline import graph_builder
        graph = await asyncio.get_event_loop().run_in_executor(
            None, graph_builder.build_graph,
            job_id, incident_id, parsed, canonical, links, risk_data,
            list(stored_files.values())
        )
        _advance_job(job_id, JobStatus.graph_generated,
                     f"Graph built: {len(graph.nodes)} nodes, {len(graph.edges)} edges")

        # ── Save graph JSON ──────────────────────────────────────────────────
        graph_json = graph.model_dump_json(indent=2)
        write_incident_json(incident_id, "graph.v1.json", graph_json)
        write_incident_json(incident_id, "audit.v1.json", graph_json)

        # ── Completed ────────────────────────────────────────────────────────
        _advance_job(job_id, JobStatus.completed, "Pipeline completed successfully")

    except Exception as exc:
        tb = traceback.format_exc()
        logger.error("Pipeline failed for job %s: %s\n%s", job_id, exc, tb)
        _fail_job(job_id, JobStatus.failed, str(exc))
