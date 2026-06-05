-- Migration: backend job tracking tables for FastAPI pipeline polling
-- Purpose: make Supabase/Postgres the single source of truth for backend job state.

CREATE TABLE IF NOT EXISTS public.jobs (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  status TEXT NOT NULL,
  stage TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jobs_incident_id_idx
  ON public.jobs (incident_id);

CREATE TABLE IF NOT EXISTS public.job_events (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  message TEXT NOT NULL,
  payload_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_events_job_id_idx
  ON public.job_events (job_id);

CREATE INDEX IF NOT EXISTS job_events_created_at_idx
  ON public.job_events (created_at);
