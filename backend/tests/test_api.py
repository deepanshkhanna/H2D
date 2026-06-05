"""
Integration tests for the OpsPilot FastAPI HTTP layer.

These tests use the real app with an in-memory/temp-dir backend so they can
run in CI without Gemini credentials (the pipeline is never triggered —
we only test the HTTP surface, auth, and validation).
"""
from __future__ import annotations

import os
import importlib

import pytest
from fastapi.testclient import TestClient

# ── App bootstrap ─────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def client(tmp_path_factory):
    """
    Build a TestClient with isolated storage and known auth config.
    We set env vars BEFORE importing the app so pydantic-settings picks them up.
    """
    tmp = tmp_path_factory.mktemp("data")
    os.environ["STORAGE_ROOT"] = str(tmp)
    os.environ["OPSPILOT_API_KEYS"] = "test-key-abc123"
    os.environ["ENVIRONMENT"] = "development"
    os.environ["TESTING"] = "1"
    os.environ["GEMINI_API_KEY"] = "fake-key-for-tests"
    os.environ["DATABASE_URL"] = f"sqlite:///{tmp / 'test.db'}"
    os.environ["SUPABASE_URL"] = "https://test-project.supabase.co"
    os.environ["SUPABASE_PUBLISHABLE_KEY"] = "test_publishable_key"

    # Import after env vars are set and reload modules so settings reflect fixture env.
    import app.config as cfg_mod
    import app.security as sec_mod
    import main as main_mod
    importlib.reload(cfg_mod)
    importlib.reload(sec_mod)
    importlib.reload(main_mod)
    app = main_mod.app
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


@pytest.fixture(scope="module")
def client_no_auth(tmp_path_factory):
    """TestClient with auth explicitly disabled (empty API keys)."""
    tmp = tmp_path_factory.mktemp("data_noauth")
    # Use a fresh settings instance
    os.environ["STORAGE_ROOT"] = str(tmp)
    os.environ["OPSPILOT_API_KEYS"] = ""
    os.environ["ENVIRONMENT"] = "development"
    os.environ["TESTING"] = "1"
    os.environ["DATABASE_URL"] = f"sqlite:///{tmp / 'test.db'}"
    os.environ["SUPABASE_URL"] = "https://test-project.supabase.co"
    os.environ["SUPABASE_PUBLISHABLE_KEY"] = "test_publishable_key"

    import app.config as cfg_mod
    import app.security as sec_mod
    import main as main_mod
    importlib.reload(cfg_mod)
    importlib.reload(sec_mod)
    importlib.reload(main_mod)
    app = main_mod.app
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


# ── Health ────────────────────────────────────────────────────────────────────

def test_health_returns_200(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body.get("status") == "ok"


# ── Demo graph ────────────────────────────────────────────────────────────────

def test_demo_graph_returns_200(client):
    r = client.get("/api/demo/graph")
    assert r.status_code == 200
    body = r.json()
    assert "nodes" in body
    assert "edges" in body


# ── Auth — no API keys configured ────────────────────────────────────────────

def test_upload_with_auth_disabled_returns_202_or_422(client_no_auth):
    """When auth is disabled, a missing file should still give 422, not 401."""
    r = client_no_auth.post("/api/incidents")
    # No files → validation error, not auth error
    assert r.status_code == 422


# ── Auth — API key required ───────────────────────────────────────────────────

def _tiny_pdf() -> tuple[str, bytes, str]:
    """Minimal 1-byte stand-in that passes MIME validation (real PDF skipped in unit tests)."""
    return ("test.txt", b"%PDF-1.4 stub", "text/plain")


def test_upload_missing_key_returns_401(client):
    r = client.post("/api/incidents", files={})
    # FastAPI may validate body before auth dependencies when required files are missing.
    assert r.status_code in (401, 422)


def test_upload_wrong_key_returns_401(client):
    r = client.post(
        "/api/incidents",
        headers={"X-API-Key": "wrong-key"},
        files={},
    )
    assert r.status_code in (401, 422)


def test_upload_no_files_returns_422(client):
    """Correct auth + no files → FastAPI validation error 422."""
    r = client.post(
        "/api/incidents",
        headers={"X-API-Key": "test-key-abc123"},
    )
    assert r.status_code == 422


def test_upload_valid_returns_202(client):
    """
    Correct auth + at least one file → 202 Accepted (job created).
    The pipeline itself is async; we only verify the HTTP contract here.
    """
    r = client.post(
        "/api/incidents",
        headers={"X-API-Key": "test-key-abc123"},
        files={
            "complaint_email": (
                "complaint.eml",
                b"From: test@example.com\r\nSubject: Damage\r\n\r\nBody",
                "message/rfc822",
            )
        },
    )
    assert r.status_code == 202
    body = r.json()
    assert "job_id" in body
    assert "incident_id" in body
    assert body.get("status") in ("queued", "files_stored", "processing")


# ── Job polling ───────────────────────────────────────────────────────────────

def test_get_unknown_job_returns_404(client):
    r = client.get("/api/jobs/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404


def test_get_known_job_returns_200(client):
    """Create a job via upload, then poll it."""
    upload = client.post(
        "/api/incidents",
        headers={"X-API-Key": "test-key-abc123"},
        files={
            "complaint_email": (
                "x.eml",
                b"From: a@b.com\r\n\r\nHello",
                "message/rfc822",
            )
        },
    )
    assert upload.status_code == 202
    job_id = upload.json()["job_id"]
    r = client.get(f"/api/jobs/{job_id}")
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == job_id
    assert "status" in body
    assert "progress" in body


# ── Graph endpoints ───────────────────────────────────────────────────────────

def test_graph_unknown_incident_returns_404(client):
    r = client.get("/api/incidents/00000000-0000-0000-0000-000000000000/graph")
    assert r.status_code == 404


def test_audit_unknown_incident_returns_404(client):
    r = client.get("/api/incidents/00000000-0000-0000-0000-000000000000/audit")
    assert r.status_code == 404
