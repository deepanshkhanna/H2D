"""
Security-focused unit tests for backend/app/security.py.

Covers: API-key validation, upload size enforcement, and MIME-type allow-list.
"""
from __future__ import annotations

import asyncio
import os

import pytest
from fastapi import HTTPException


# ── Settings helpers ──────────────────────────────────────────────────────────

def _reload_settings(keys: str = "key1,key2", max_bytes: int = 100, rpm: int = 5):
    os.environ["OPSPILOT_API_KEYS"] = keys
    os.environ["MAX_UPLOAD_BYTES"] = str(max_bytes)
    os.environ["RATE_LIMIT_PER_MINUTE"] = str(rpm)
    os.environ["ENVIRONMENT"] = "development"
    os.environ.setdefault("GEMINI_API_KEY", "")
    os.environ.setdefault("TESTING", "1")
    import importlib
    import app.config as cfg_mod
    importlib.reload(cfg_mod)
    return cfg_mod.settings


# ── Settings unit tests ───────────────────────────────────────────────────────

def test_settings_auth_enabled_when_keys_set():
    s = _reload_settings(keys="alpha,beta")
    assert s.auth_enabled is True
    assert len(s.api_keys_list) == 2


def test_settings_auth_disabled_when_keys_empty():
    s = _reload_settings(keys="")
    assert s.auth_enabled is False
    assert s.api_keys_list == []


def test_settings_is_production_false_by_default():
    s = _reload_settings()
    assert s.is_production is False


def test_settings_is_production_true_when_env_set():
    os.environ["ENVIRONMENT"] = "production"
    import importlib
    import app.config as cfg_mod
    importlib.reload(cfg_mod)
    assert cfg_mod.settings.is_production is True
    # Clean up
    os.environ["ENVIRONMENT"] = "development"
    importlib.reload(cfg_mod)


def test_cors_origins_list_whitespace_trimmed():
    os.environ["CORS_ORIGINS"] = "http://a.com, http://b.com , http://c.com"
    import importlib
    import app.config as cfg_mod
    importlib.reload(cfg_mod)
    assert cfg_mod.settings.cors_origins_list == ["http://a.com", "http://b.com", "http://c.com"]
    del os.environ["CORS_ORIGINS"]
    importlib.reload(cfg_mod)


# ── require_api_key dependency ────────────────────────────────────────────────

def test_valid_key_does_not_raise():
    _reload_settings(keys="valid-key-xyz")
    import importlib
    import app.security as sec
    importlib.reload(sec)
    # No exception should be raised
    sec.require_api_key(x_api_key="valid-key-xyz")


def test_invalid_key_raises_401():
    _reload_settings(keys="valid-key-xyz")
    import importlib
    import app.security as sec
    importlib.reload(sec)
    with pytest.raises(HTTPException) as exc_info:
        sec.require_api_key(x_api_key="bad-key")
    assert exc_info.value.status_code == 401


def test_missing_key_raises_401():
    _reload_settings(keys="valid-key-xyz")
    import importlib
    import app.security as sec
    importlib.reload(sec)
    with pytest.raises(HTTPException) as exc_info:
        sec.require_api_key(x_api_key=None)
    assert exc_info.value.status_code == 401


def test_auth_disabled_allows_any_value():
    """When no keys are configured, require_api_key must be a no-op."""
    _reload_settings(keys="")
    import importlib
    import app.security as sec
    importlib.reload(sec)
    # Both None and arbitrary strings should pass silently
    sec.require_api_key(x_api_key=None)
    sec.require_api_key(x_api_key="whatever")


# ── Upload size enforcement ───────────────────────────────────────────────────

class _FakeUpload:
    def __init__(self, content: bytes, content_type: str = "text/plain", filename: str = "test.txt"):
        self._data = content
        self.content_type = content_type
        self.filename = filename
        self._pos = 0

    async def read(self, n: int = -1) -> bytes:
        if n == -1:
            chunk, self._pos = self._data[self._pos :], len(self._data)
        else:
            chunk = self._data[self._pos : self._pos + n]
            self._pos += len(chunk)
        return chunk


def test_upload_over_size_limit_raises_413():
    _reload_settings(max_bytes=10)
    import importlib
    import app.security as sec
    importlib.reload(sec)

    large_upload = _FakeUpload(b"x" * 20, content_type="text/plain")  # 20 > 10
    with pytest.raises(HTTPException) as exc_info:
        asyncio.get_event_loop().run_until_complete(
            sec.read_validated_upload(large_upload, "complaint_email")
        )
    assert exc_info.value.status_code == 413


def test_upload_within_size_limit_succeeds():
    _reload_settings(max_bytes=100)
    import importlib
    import app.security as sec
    importlib.reload(sec)

    small_upload = _FakeUpload(b"hello world", content_type="text/plain")
    data = asyncio.get_event_loop().run_until_complete(
        sec.read_validated_upload(small_upload, "complaint_email")
    )
    assert data == b"hello world"


# ── MIME allow-list ───────────────────────────────────────────────────────────

def test_allowed_content_types_present():
    """ALLOWED_CONTENT_TYPES must cover PDF, EML, and image roles."""
    import importlib
    import app.security as sec
    importlib.reload(sec)

    ct = sec.ALLOWED_CONTENT_TYPES
    assert "application/pdf" in ct["invoice_pdf"]
    assert "message/rfc822" in ct["complaint_email"]
    assert "image/jpeg" in ct["damage_image"]
    assert "image/png" in ct["damage_image"]


def test_disallowed_content_type_raises_422():
    _reload_settings(max_bytes=1_000_000)
    import importlib
    import app.security as sec
    importlib.reload(sec)

    bad_upload = _FakeUpload(b"data", content_type="application/x-sh", filename="evil.sh")
    with pytest.raises(HTTPException) as exc_info:
        asyncio.get_event_loop().run_until_complete(
            sec.read_validated_upload(bad_upload, "invoice_pdf")
        )
    assert exc_info.value.status_code == 422


def test_damage_image_invalid_magic_bytes_raises_422():
    _reload_settings(max_bytes=1_000_000)
    import importlib
    import app.security as sec
    importlib.reload(sec)

    # Declares jpeg but body is plain text.
    bad_upload = _FakeUpload(b"not-an-image", content_type="image/jpeg", filename="fake.jpg")
    with pytest.raises(HTTPException) as exc_info:
        asyncio.get_event_loop().run_until_complete(
            sec.read_validated_upload(bad_upload, "damage_image")
        )
    assert exc_info.value.status_code == 422


def test_damage_image_jpeg_magic_bytes_succeeds():
    _reload_settings(max_bytes=1_000_000)
    import importlib
    import app.security as sec
    importlib.reload(sec)

    jpeg_like = b"\xff\xd8\xff\xe0" + b"x" * 16
    upload = _FakeUpload(jpeg_like, content_type="image/jpeg", filename="ok.jpg")
    data = asyncio.get_event_loop().run_until_complete(
        sec.read_validated_upload(upload, "damage_image")
    )
    assert data == jpeg_like


def test_invoice_pdf_rejects_image_magic_bytes():
    _reload_settings(max_bytes=1_000_000)
    import importlib
    import app.security as sec
    importlib.reload(sec)

    png_like = b"\x89PNG\r\n\x1a\n" + b"x" * 8
    bad_upload = _FakeUpload(png_like, content_type="application/pdf", filename="invoice.pdf")
    with pytest.raises(HTTPException) as exc_info:
        asyncio.get_event_loop().run_until_complete(
            sec.read_validated_upload(bad_upload, "invoice_pdf")
        )
    assert exc_info.value.status_code == 422


def test_dangerous_mimes_not_in_any_role():
    """Executable and script MIME types must not appear in any role's allow-list."""
    import importlib
    import app.security as sec
    importlib.reload(sec)

    dangerous = [
        "application/x-executable",
        "application/x-sh",
        "text/x-python",
        "application/javascript",
        "text/javascript",
        "application/x-msdownload",
    ]
    all_allowed: set[str] = set()
    for allowed_set in sec.ALLOWED_CONTENT_TYPES.values():
        all_allowed.update(allowed_set)

    for mime in dangerous:
        assert mime not in all_allowed, f"Dangerous MIME {mime!r} must not be in allow-list"

