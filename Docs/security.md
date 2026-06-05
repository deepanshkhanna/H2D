# Security

## Security posture

OpsPilot prioritizes evidence integrity, access control, and explainable output.

## Controls in place

- API-key protection on write routes.
- Runtime production guardrails for missing critical secrets.
- Upload validation by file type and size.
- Rate limiting for write endpoints.
- CORS restrictions for approved origins.
- Supabase-backed durable storage for evidence artifacts.

## Provenance and integrity controls

- SHA-256 hashing at ingest for every evidence artifact.
- Immutable artifact metadata persisted in Postgres.
- Audit artifact includes graph hash and confidence breakdown records.
- Job events provide stage-by-stage forensic timeline.

## Operational recommendations

- Rotate API keys and Supabase service-role credentials regularly.
- Restrict storage bucket policies to least privilege.
- Monitor failed auth/rate-limit events and unusual artifact access patterns.
- Keep dependencies updated through CI security scans.
