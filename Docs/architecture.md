# Architecture

OpsPilot AI is a provenance-first multimodal incident intelligence system.

## Core flow

1. User uploads incident evidence (invoice, complaint email, damage image).
2. Backend creates a durable job and stores immutable artifact metadata.
3. Pipeline parses evidence, extracts entities, scores links, and computes risk.
4. Backend emits a graph plus audit artifact with confidence breakdowns.
5. UI polls job status and renders explainable graph conclusions.

## System components

- Frontend: TanStack Start + React UI for upload, monitoring, graph exploration.
- Backend: FastAPI service with staged, auditable processing pipeline.
- Database: Postgres (Supabase) for jobs, events, artifact lineage.
- Object storage: Supabase Storage for durable evidence/artifact persistence.

## Reliability model

- Jobs are persisted and recoverable across restarts.
- Artifact lineage is persisted with hash, role, storage path, and timestamps.
- Every stage emits structured job events for replay/reconstruction.
- Pipeline outputs are versioned (`graph.v1.json`, `audit.v1.json`).

## Chain of custody guarantees

- Evidence hashes are computed at ingest and persisted.
- Storage references are immutable audit records.
- Graph integrity hash is stored in audit output.
- Confidence scoring components are retained for explainability.

## Design principles

- Keep one product path (provenance graph), avoid split-brain architecture.
- Favor durability and auditability over architectural complexity.
- Scale incrementally from a robust monolith, not premature microservices.
