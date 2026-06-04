"""
Gemini Flash AI client.
Handles:
  1. Damage image analysis (vision)
  2. Structured entity extraction (JSON mode)
  3. Response caching by prompt hash
"""

from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path
from typing import Any

from app.config import settings
from app.ai.cache import get_cached, set_cached

logger = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is None:
        import google.generativeai as genai
        genai.configure(api_key=settings.gemini_api_key)
        _client = genai.GenerativeModel("gemini-1.5-flash")
    return _client


async def analyze_damage_image(path: str, incident_id: str) -> dict[str, Any]:
    """
    Use Gemini vision to analyze a damage photo.
    Returns structured labels with confidence.
    """
    image_bytes = Path(path).read_bytes()
    prompt_hash = hashlib.sha256(image_bytes[:4096]).hexdigest()[:16]

    # Check cache
    cached = get_cached(f"vision_{prompt_hash}")
    if cached:
        return json.loads(cached)

    # No Gemini key → return safe fallback
    if not settings.gemini_api_key or settings.gemini_api_key == "your_gemini_api_key_here":
        result = _vision_fallback(path)
        set_cached(f"vision_{prompt_hash}", json.dumps(result))
        return result

    try:
        import google.generativeai as genai
        client = _get_client()
        img_part = {"mime_type": _guess_mime(path), "data": image_bytes}
        prompt = (
            "Analyze this damage photograph for a logistics/insurance incident.\n"
            "Return ONLY valid JSON (no markdown) matching this schema:\n"
            "{\n"
            '  "damage_detected": true/false,\n'
            '  "labels": [{"label": "...", "confidence": 0.0-1.0, "location": "..."}],\n'
            '  "severity": "none|low|medium|high|critical",\n'
            '  "damage_types": ["crushed_corner"|"water_damage"|"torn_packaging"|"missing_item"|"general_damage"],\n'
            '  "visible_text": ["any text visible in image"],\n'
            '  "summary": "one sentence description"\n'
            "}"
        )
        response = client.generate_content([prompt, img_part])
        raw = response.text.strip()
        # Strip markdown if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        parsed = json.loads(raw)
        parsed["path"] = path
        parsed["incident_id"] = incident_id
        set_cached(f"vision_{prompt_hash}", json.dumps(parsed))
        return parsed

    except Exception as e:
        logger.warning("Gemini vision failed: %s — using fallback", e)
        result = _vision_fallback(path)
        set_cached(f"vision_{prompt_hash}", json.dumps(result))
        return result


def _vision_fallback(path: str) -> dict[str, Any]:
    """Fallback when Gemini is unavailable — attempt basic PIL analysis."""
    try:
        from PIL import Image
        img = Image.open(path)
        w, h = img.size
        return {
            "damage_detected": True,
            "labels": [
                {"label": "damage visible", "confidence": 0.6, "location": "unknown"}
            ],
            "severity": "medium",
            "damage_types": ["general_damage"],
            "visible_text": [],
            "summary": f"Damage image ({w}x{h}). Manual inspection required.",
            "path": path,
            "fallback": True,
        }
    except Exception:
        return {
            "damage_detected": False,
            "labels": [],
            "severity": "none",
            "damage_types": [],
            "visible_text": [],
            "summary": "Image could not be analyzed.",
            "path": path,
            "fallback": True,
        }


def _guess_mime(path: str) -> str:
    path_lower = path.lower()
    if path_lower.endswith(".jpg") or path_lower.endswith(".jpeg"):
        return "image/jpeg"
    if path_lower.endswith(".png"):
        return "image/png"
    if path_lower.endswith(".webp"):
        return "image/webp"
    return "image/jpeg"
