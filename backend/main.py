"""
OpsPilot AI — FastAPI entry point.
Run with: uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import create_tables
from app.routers import incidents, jobs, graph, demo

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


def validate_production_config():
    """Enforce required config in production mode."""
    if not settings.is_production:
        return
    errors = []
    if not settings.database_url:
        errors.append("DATABASE_URL not set")
    if not settings.supabase_url:
        errors.append("SUPABASE_URL not set")
    if not settings.supabase_service_role_key:
        errors.append("SUPABASE_SERVICE_ROLE_KEY not set")
    if not settings.gemini_api_key:
        errors.append("GEMINI_API_KEY not set")
    if not settings.api_keys_list:
        errors.append("OPSPILOT_API_KEYS not set")
    if errors:
        raise RuntimeError(f"Production startup failed: {'; '.join(errors)}")
    logger.info("Production config validation passed.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    validate_production_config()
    create_tables()
    # Recover any unfinished jobs from previous runs
    from app.pipeline.orchestrator import recover_unfinished_jobs
    recovered = recover_unfinished_jobs()
    if recovered > 0:
        logger.info("Recovered %d unfinished jobs from previous runs", recovered)
    logger.info("OpsPilot AI backend started. Storage: %s", settings.storage_root)
    yield
    # Shutdown
    logger.info("OpsPilot AI backend stopping.")


app = FastAPI(
    title="OpsPilot AI",
    description="Provenance-first multimodal evidence correlation engine.",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(incidents.router)
app.include_router(jobs.router)
app.include_router(graph.router)
app.include_router(demo.router)


@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
