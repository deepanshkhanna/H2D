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


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    create_tables()
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
