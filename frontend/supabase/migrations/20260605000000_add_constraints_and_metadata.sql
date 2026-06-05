-- Migration: add constraints, metadata columns, and unique indexes
-- Applied after: 20260604000000_fix_model_default.sql

-- ── Confidence range guards ────────────────────────────────────────────────────
-- Ensure AI-generated confidence scores stay in the allowed 0–100 range.

ALTER TABLE conclusions
  ADD CONSTRAINT conclusions_confidence_range
    CHECK (confidence >= 0 AND confidence <= 100);

ALTER TABLE entities
  ADD CONSTRAINT entities_confidence_range
    CHECK (confidence >= 0 AND confidence <= 100);

-- ── Financial exposure guards ─────────────────────────────────────────────────
-- Monetary values stored in cents must never be negative.

ALTER TABLE conclusions
  ADD CONSTRAINT conclusions_financial_exposure_non_negative
    CHECK (financial_exposure_cents >= 0);

-- ── Primary conclusion uniqueness ─────────────────────────────────────────────
-- Only one primary conclusion per case is allowed at a time.
-- Using a partial unique index so non-primary rows are not constrained.

CREATE UNIQUE INDEX IF NOT EXISTS one_primary_conclusion_per_case
  ON conclusions (case_id)
  WHERE is_primary = TRUE;

-- ── Case metadata column ──────────────────────────────────────────────────────
-- Stores backend pipeline references (job_id, incident_id) and other
-- structured metadata without requiring schema migrations per new field.

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN cases.metadata IS
  'Unstructured metadata bag. Well-known keys: backend_job_id (text), '
  'backend_incident_id (text), backend_graph_available (bool). '
  'Do not rely on these keys in application logic; prefer dedicated columns.';

-- ── Evidence kind check ────────────────────────────────────────────────────────
-- Guard the kind column against values outside the defined enum.
-- (Supabase may already enforce this via the enum type, but belt-and-suspenders.)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'evidence_kind_check' AND conrelid = 'evidence'::regclass
  ) THEN
    ALTER TABLE evidence
      ADD CONSTRAINT evidence_kind_check
        CHECK (kind IN ('invoice', 'email', 'manifest', 'inspection', 'photo', 'other'));
  END IF;
END
$$;
