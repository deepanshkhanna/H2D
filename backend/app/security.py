"""
Security primitives (Phase T3):
  - API-key authentication dependency for write routes
  - Lightweight in-process per-IP rate limiter (no external dependency)
  - Upload validation (size cap + content-type allowlist per role)

These are intentionally dependency-free so they work in constrained/offline
environments. For multi-instance production, replace the in-process limiter with
a shared store (e.g. Redis) — tracked in Phase T7.
"""

from __future__ import annotations

import logging
import time
from collections import defaultdict, deque
from typing import Optional

from fastapi import Header, HTTPException, Request, UploadFile

from app.config import settings

logger = logging.getLogger(__name__)


# ── API-key auth ───────────────────────────────────────────────────────────────

def require_api_key(x_api_key: Optional[str] = Header(default=None)) -> None:
    """
    FastAPI dependency. Enforces a valid `X-API-Key` header when
    `OPSPILOT_API_KEYS` is configured. No-op (with startup warning) when unset.
    """
    if not settings.auth_enabled:
        return
    if not x_api_key or x_api_key not in settings.api_keys_list:
        raise HTTPException(status_code=401, detail="Invalid or missing API key.")


# ── In-process rate limiter ─────────────────────────────────────────────────────

_REQUEST_LOG: dict[str, deque[float]] = defaultdict(deque)
_WINDOW_SECONDS = 60.0


def _client_ip(request: Request) -> str:
    # Honor a single proxy hop if present, else peer address.
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(request: Request) -> None:
    """
    FastAPI dependency. Sliding-window limiter of
    `settings.rate_limit_per_minute` requests per client IP.
    """
    limit = settings.rate_limit_per_minute
    if limit <= 0:
        return
    now = time.monotonic()
    ip = _client_ip(request)
    bucket = _REQUEST_LOG[ip]
    cutoff = now - _WINDOW_SECONDS
    while bucket and bucket[0] < cutoff:
        bucket.popleft()
    if len(bucket) >= limit:
        retry = max(1, int(_WINDOW_SECONDS - (now - bucket[0])))
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Try again later.",
            headers={"Retry-After": str(retry)},
        )
    bucket.append(now)


# ── Upload validation ───────────────────────────────────────────────────────────

# Allowed content types per upload role. Generous but bounded; demo inputs use
# text/plain and message/rfc822.
ALLOWED_CONTENT_TYPES: dict[str, set[str]] = {
    "invoice_pdf": {
        "application/pdf",
        "text/plain",
        "application/octet-stream",  # some clients omit a precise type
    },
    "complaint_email": {
        "message/rfc822",
        "text/plain",
        "text/html",
        "application/octet-stream",
    },
    "damage_image": {
        "image/jpeg",
        "image/png",
        "image/webp",
    },
}


def _is_pdf(data: bytes) -> bool:
    return data.startswith(b"%PDF-")


def _is_png(data: bytes) -> bool:
    return data.startswith(b"\x89PNG\r\n\x1a\n")


def _is_jpeg(data: bytes) -> bool:
    return data.startswith(b"\xff\xd8\xff")


def _is_webp(data: bytes) -> bool:
    return len(data) >= 12 and data.startswith(b"RIFF") and data[8:12] == b"WEBP"


def _looks_like_rfc822(data: bytes) -> bool:
    # Heuristic: email-like headers in first line block (good enough for gatekeeping).
    head = data[:4096]
    return any(
        token in head
        for token in [b"From:", b"To:", b"Subject:", b"Date:"]
    )


def _validate_magic_bytes(data: bytes, role: str) -> None:
    if not data:
        raise HTTPException(status_code=422, detail=f"Uploaded file for {role} is empty.")

    if role == "invoice_pdf":
        # invoice role also permits text/plain for OCR fallback/demo text fixtures.
        if _is_pdf(data):
            return
        # Reject known binary formats masquerading as invoice text.
        if any([_is_png(data), _is_jpeg(data), _is_webp(data)]):
            raise HTTPException(
                status_code=422,
                detail="invoice_pdf payload signature does not match PDF/text expectations.",
            )
        return

    if role == "complaint_email":
        # complaint_email supports .eml and plain text fixtures.
        if _is_pdf(data) or _is_png(data) or _is_jpeg(data) or _is_webp(data):
            raise HTTPException(
                status_code=422,
                detail="complaint_email payload signature does not match email/text expectations.",
            )
        return

    if role == "damage_image":
        if _is_png(data) or _is_jpeg(data) or _is_webp(data):
            return
        raise HTTPException(
            status_code=422,
            detail="damage_image payload signature is not a supported image format (jpeg/png/webp).",
        )


async def read_validated_upload(upload: UploadFile, role: str) -> bytes:
    """
    Read an UploadFile fully while enforcing the per-file size cap and the
    content-type allowlist for `role`. Returns the validated bytes.
    """
    allowed = ALLOWED_CONTENT_TYPES.get(role, set())
    ctype = (upload.content_type or "application/octet-stream").lower()
    if allowed and ctype not in allowed:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported content type '{ctype}' for {role}. Allowed: {sorted(allowed)}",
        )

    max_bytes = settings.max_upload_bytes
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await upload.read(1024 * 256)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"File '{upload.filename}' exceeds the {max_bytes} byte limit.",
            )
        chunks.append(chunk)
    data = b"".join(chunks)
    _validate_magic_bytes(data, role)
    return data
