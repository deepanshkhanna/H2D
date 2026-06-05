-- Fix hallucinated model identifier (Phase T5).
--
-- The initial schema set the conclusions.model_name default to
-- 'google/gemini-3-flash-preview', a model that does not exist. Per ADR-004 the
-- project standardizes on 'gemini-1.5-flash'. Applied migrations are immutable,
-- so this corrective migration updates the column default and backfills any rows
-- still carrying the bogus value.

ALTER TABLE public.conclusions
  ALTER COLUMN model_name SET DEFAULT 'gemini-1.5-flash';

UPDATE public.conclusions
  SET model_name = 'gemini-1.5-flash'
  WHERE model_name = 'google/gemini-3-flash-preview';
