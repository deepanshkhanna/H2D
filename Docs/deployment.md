# Deployment

## Prerequisites

- Docker Desktop (recommended for local/staging parity)
- Supabase project (Postgres + Storage bucket)
- Backend and frontend environment files configured

## Local stack

```bash
docker compose up --build
```

Services:

- Backend: http://localhost:8000
- Frontend: http://localhost:3000
- Postgres (local compose): `postgres:5432`

## Required environment configuration

Backend requires:

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (required in production)
- `SUPABASE_STORAGE_BUCKET`
- `OPSPILOT_API_KEYS` (required in production)

Frontend requires:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_OPSPILOT_API_URL`

## CI/CD gates

GitHub Actions pipeline validates:

- DB migration script
- Backend lint/test/security audit
- Frontend lint/typecheck/build/audit
- Docker compose build

Note: dependency vulnerability scans run in report mode (non-blocking) so CI remains reliable while surfacing issues for remediation.

## Production readiness checklist

1. Supabase migrations applied.
2. Storage bucket and policies verified.
3. Backend startup checks pass in production mode.
4. CI workflow green on target commit.
5. End-to-end upload -> graph -> artifact traceability verified.

## Rollback strategy

- Redeploy prior image tag.
- Restore DB from snapshot if schema/data corruption occurs.
- Preserve artifact lineage records for forensic continuity.
