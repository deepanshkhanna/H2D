from __future__ import annotations

import importlib
import os
from pathlib import Path

from sqlmodel import SQLModel, Session, select


def _bootstrap(tmp_path: Path):
    os.environ["TESTING"] = "1"
    os.environ["ENVIRONMENT"] = "development"
    os.environ["DATABASE_URL"] = f"sqlite:///{tmp_path / 'durability.db'}"
    os.environ["STORAGE_ROOT"] = str(tmp_path / "data")
    os.environ["SUPABASE_URL"] = "https://test-project.supabase.co"
    os.environ["SUPABASE_PUBLISHABLE_KEY"] = "test_publishable_key"

    import app.config as cfg
    import app.database as db
    import app.models as models
    import app.pipeline.orchestrator as orchestrator

    importlib.reload(cfg)
    importlib.reload(db)
    db._engine = None
    importlib.reload(orchestrator)

    SQLModel.metadata.create_all(db.get_engine())
    return db, models, orchestrator


def test_recovery_reconstructs_job_from_artifacts(tmp_path, monkeypatch):
    db, models, orchestrator = _bootstrap(tmp_path)

    job = models.Job(
        id="job-1",
        incident_id="incident-1",
        status=models.JobStatus.entities_extracted,
        stage=models.JobStatus.entities_extracted,
        progress=56,
    )
    artifact = models.IncidentArtifact(
        incident_id="incident-1",
        job_id="job-1",
        artifact_kind="input",
        role="complaint_email",
        sha256="abc123",
        storage_backend="local",
        storage_path=str(tmp_path / "data" / "uploads" / "incident-1" / "complaint_email" / "abc123" / "mail.eml"),
        metadata_json='{"original_filename":"mail.eml","uploaded_at":"2026-01-01T00:00:00+00:00"}',
    )

    local_file = Path(artifact.storage_path)
    local_file.parent.mkdir(parents=True, exist_ok=True)
    local_file.write_text("From: test@example.com\n\nbody", encoding="utf-8")

    with Session(db.get_engine()) as session:
        session.add(job)
        session.add(artifact)
        session.commit()

    calls: list[tuple[str, str, dict]] = []

    def _fake_enqueue(job_id: str, incident_id: str, stored_files: dict):
        calls.append((job_id, incident_id, stored_files))

    monkeypatch.setattr(orchestrator, "enqueue_pipeline", _fake_enqueue)

    resumed = orchestrator.recover_unfinished_jobs()
    assert resumed == 1
    assert len(calls) == 1
    assert calls[0][0] == "job-1"
    assert calls[0][1] == "incident-1"
    assert "complaint_email" in calls[0][2]

    with Session(db.get_engine()) as session:
        refreshed = session.get(models.Job, "job-1")
        assert refreshed is not None
        assert refreshed.status == models.JobStatus.queued
        events = session.exec(select(models.JobEvent).where(models.JobEvent.job_id == "job-1")).all()
        assert any("Recovered job after restart" in e.message for e in events)


def test_store_upload_and_materialize_local(tmp_path):
    _db, _models, _orchestrator = _bootstrap(tmp_path)
    import app.storage as storage
    importlib.reload(storage)

    data = b"critical evidence"
    artifact = storage.store_upload(
        data=data,
        incident_id="incident-2",
        role="invoice_pdf",
        original_filename="invoice.pdf",
        content_type="application/pdf",
    )
    assert artifact["storage_backend"] == "local"
    assert artifact["sha256"]

    materialized = storage.materialize_artifact("incident-2", artifact)
    assert materialized.exists()
    assert materialized.read_bytes() == data
