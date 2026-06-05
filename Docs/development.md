# Development

## Quick start

Backend:

```bash
cd backend
python -m venv .venv
. .venv/Scripts/Activate.ps1
pip install -r requirements-dev.txt
uvicorn main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
bun install
bun run dev
```

## Test and quality commands

Backend:

```bash
python -m ruff check backend --ignore F401,F541,F841
python -m pytest -q backend/tests -k "not durability and not security"
```

Docker:

```bash
docker compose build
```

## Coding standards

- Preserve provenance metadata for every artifact transformation.
- Keep pipeline stages deterministic and auditable where practical.
- Record meaningful job events for every stage transition.
- Avoid architecture changes that dilute the core evidence-graph product.

## Key implementation areas

- `backend/app/pipeline/` - processing stages and orchestration
- `backend/app/storage.py` - durable artifact storage abstraction
- `backend/app/models.py` - graph, job, and artifact contracts
- `backend/app/routers/` - API entry points
- `frontend/src/` - user flows and graph rendering
