
-- Enums
CREATE TYPE public.case_status AS ENUM ('investigating','correlating','review_needed','confirmed','resolved');
CREATE TYPE public.case_severity AS ENUM ('low','medium','high','critical');
CREATE TYPE public.evidence_kind AS ENUM ('invoice','email','manifest','inspection','photo','other');
CREATE TYPE public.evidence_status AS ENUM ('uploaded','extracting','extracted','failed');
CREATE TYPE public.strength_label AS ENUM ('strong','confirmed','likely','weak','unverified');
CREATE TYPE public.case_event_kind AS ENUM ('evidence_uploaded','entity_extracted','correlation_found','conclusion_generated','status_changed');

-- Cases
CREATE TABLE public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  reference TEXT NOT NULL,
  status public.case_status NOT NULL DEFAULT 'investigating',
  severity public.case_severity NOT NULL DEFAULT 'medium',
  financial_exposure_cents BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cases TO authenticated;
GRANT ALL ON public.cases TO service_role;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cases select" ON public.cases FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own cases insert" ON public.cases FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own cases update" ON public.cases FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own cases delete" ON public.cases FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Evidence
CREATE TABLE public.evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.evidence_kind NOT NULL,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  status public.evidence_status NOT NULL DEFAULT 'uploaded',
  extracted_json JSONB,
  summary TEXT,
  input_hash TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidence TO authenticated;
GRANT ALL ON public.evidence TO service_role;
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own evidence all" ON public.evidence FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Entities
CREATE TABLE public.entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_evidence_id UUID NOT NULL REFERENCES public.evidence(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entities TO authenticated;
GRANT ALL ON public.entities TO service_role;
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own entities all" ON public.entities FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Conclusions
CREATE TABLE public.conclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  severity public.case_severity NOT NULL DEFAULT 'medium',
  root_cause TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  confidence NUMERIC(5,2) NOT NULL,
  strength_label public.strength_label NOT NULL,
  financial_exposure_cents BIGINT NOT NULL DEFAULT 0,
  recommended_action TEXT,
  needs_human_review BOOLEAN NOT NULL DEFAULT false,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  model_name TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  model_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  input_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conclusions TO authenticated;
GRANT ALL ON public.conclusions TO service_role;
ALTER TABLE public.conclusions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own conclusions all" ON public.conclusions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- conclusion_evidence join
CREATE TABLE public.conclusion_evidence (
  conclusion_id UUID NOT NULL REFERENCES public.conclusions(id) ON DELETE CASCADE,
  evidence_id UUID NOT NULL REFERENCES public.evidence(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (conclusion_id, evidence_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conclusion_evidence TO authenticated;
GRANT ALL ON public.conclusion_evidence TO service_role;
ALTER TABLE public.conclusion_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ce all" ON public.conclusion_evidence FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- case_events (timeline + playback)
CREATE TABLE public.case_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.case_event_kind NOT NULL,
  title TEXT NOT NULL,
  payload JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_events TO authenticated;
GRANT ALL ON public.case_events TO service_role;
ALTER TABLE public.case_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own events all" ON public.case_events FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Indexes
CREATE INDEX ON public.cases (user_id, created_at DESC);
CREATE INDEX ON public.evidence (case_id);
CREATE INDEX ON public.entities (case_id);
CREATE INDEX ON public.conclusions (case_id);
CREATE INDEX ON public.case_events (case_id, occurred_at);

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('evidence','evidence', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: per-user folder
CREATE POLICY "evidence read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'evidence' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "evidence insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'evidence' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "evidence update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'evidence' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "evidence delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'evidence' AND (storage.foldername(name))[1] = auth.uid()::text);
