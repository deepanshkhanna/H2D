#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGRATIONS_DIR="$ROOT_DIR/frontend/supabase/migrations"

bootstrap_db() {
  local db_url="$1"
  psql "$db_url" -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY
);
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$ SELECT '00000000-0000-0000-0000-000000000000'::uuid $$;

CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS storage.objects (
  id bigserial PRIMARY KEY,
  bucket_id text NOT NULL,
  name text NOT NULL
);
CREATE OR REPLACE FUNCTION storage.foldername(name text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$ SELECT string_to_array(name, '/') $$;
SQL
}

apply_migrations() {
  local db_url="$1"
  for file in "$MIGRATIONS_DIR"/*.sql; do
    echo "Applying migration: $(basename "$file")"
    psql "$db_url" -v ON_ERROR_STOP=1 -f "$file"
  done
}

check_constraints() {
  local db_url="$1"
  psql "$db_url" -v ON_ERROR_STOP=1 <<'SQL'
SELECT conname
FROM pg_constraint
WHERE conname IN (
  'conclusions_confidence_range',
  'entities_confidence_range',
  'conclusions_financial_exposure_non_negative',
  'evidence_kind_check'
)
ORDER BY conname;

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public' AND indexname = 'one_primary_conclusion_per_case';
SQL
}

DB1="opspilot_ci_one"
DB2="opspilot_ci_two"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $DB1;"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $DB2;"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE $DB1;"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE $DB2;"

DB1_URL="${DATABASE_URL%/*}/$DB1"
DB2_URL="${DATABASE_URL%/*}/$DB2"

bootstrap_db "$DB1_URL"
apply_migrations "$DB1_URL"
check_constraints "$DB1_URL"

# Rehearsal second run against a fresh DB (simulates clean checkout/deploy)
bootstrap_db "$DB2_URL"
apply_migrations "$DB2_URL"
check_constraints "$DB2_URL"

echo "Supabase migration validation completed successfully."
