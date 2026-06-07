# OpsPilot AI

Provenance-first multimodal incident intelligence.

OpsPilot AI converts operational evidence (invoice, complaint email, damage image)
into an auditable incident graph with confidence-aware, explainable conclusions.

## Why OpsPilot

Incident response often fails because evidence is fragmented across formats and systems.
OpsPilot focuses on one core outcome:

- reliable cross-document correlation,
- explicit provenance for every claim,
- chain-of-custody-preserving artifact handling,
- replayable incident processing history.

## Core capabilities

- Durable incident jobs with restart/recovery behavior.
- Stage-by-stage job events for operational observability.
- Persistent artifact lineage with hash, role, timestamp, and storage reference.
- Explainable graph output (`graph.v1.json`) plus audit artifact (`audit.v1.json`).
- Supabase-backed artifact durability path for production-grade storage.

## Architecture (high level)

- Frontend: TanStack Start + React UI.
- Backend: FastAPI processing pipeline.
- Database: Postgres/Supabase for jobs, events, artifact lineage.
- Object storage: Supabase Storage for evidence and generated artifacts.

## Repository layout

- `.github/` CI/CD workflows and migration validation scripts.
- `backend/` API, pipeline, security, storage, tests.
- `frontend/` web application and Supabase migrations.
- `docs/` consolidated engineering and product documentation.
- `docker-compose.yml` local/staging stack.

## Quick start

### 1) Configure environment

- Copy `backend/.env.example` to `backend/.env`.
- Copy `frontend/.env.example` to `frontend/.env`.

### 2) Run with Docker (recommended)

```bash
docker compose up --build
```

- Backend: http://localhost:8000
- Frontend: http://localhost:3000

### 3) Run quality checks

```bash
python -m ruff check backend --ignore F401,F541,F841
python -m pytest -q backend/tests -k "not durability and not security"
docker compose build
```

## API snapshot

- `POST /api/incidents` create incident job from uploaded evidence.
- `GET /api/jobs/{job_id}` poll status and stage events.
- `GET /api/incidents/{incident_id}/graph` retrieve evidence graph.
- `GET /api/incidents/{incident_id}/audit` retrieve provenance audit artifact.

## Documentation

- `docs/architecture.md`
- `docs/deployment.md`
- `docs/security.md`
- `docs/development.md`
- `docs/roadmap.md`

## Status

The repository is organized as a production-candidate engineering codebase with
focus on reliability, recoverability, and auditability of the core product path.

## License

MIT. See `LICENSE`.
