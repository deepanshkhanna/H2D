-- Migration: durable artifact lineage table for restart-safe replay and chain-of-custody.

CREATE TABLE IF NOT EXISTS public.incident_artifacts (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  job_id TEXT REFERENCES public.jobs(id) ON DELETE CASCADE,
  artifact_kind TEXT NOT NULL,
  role TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  storage_backend TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS incident_artifacts_incident_idx
  ON public.incident_artifacts (incident_id);

CREATE INDEX IF NOT EXISTS incident_artifacts_job_idx
  ON public.incident_artifacts (job_id);

CREATE INDEX IF NOT EXISTS incident_artifacts_kind_idx
  ON public.incident_artifacts (artifact_kind);
