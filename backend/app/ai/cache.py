"""
Simple disk-backed cache for AI responses keyed by prompt hash.
Prevents duplicate API calls for identical inputs during demo.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)

_cache_dir: Path | None = None


def _get_cache_dir() -> Path:
    global _cache_dir
    if _cache_dir is None:
        _cache_dir = Path(settings.storage_root) / "ai_cache"
        _cache_dir.mkdir(parents=True, exist_ok=True)
    return _cache_dir


def get_cached(key: str) -> str | None:
    p = _get_cache_dir() / f"{key}.json"
    if p.exists():
        try:
            return p.read_text(encoding="utf-8")
        except Exception:
            return None
    return None


def set_cached(key: str, value: str) -> None:
    p = _get_cache_dir() / f"{key}.json"
    try:
        p.write_text(value, encoding="utf-8")
    except Exception as e:
        logger.warning("Cache write failed for %s: %s", key, e)
