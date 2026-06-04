"""
Content-addressed local file storage.
Files are stored as: {storage_root}/uploads/{sha256[:2]}/{sha256}/{original_name}
"""

import hashlib
import shutil
from pathlib import Path

from app.config import settings


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def store_upload(data: bytes, original_filename: str) -> tuple[str, Path]:
    """
    Store raw bytes content-addressed.
    Returns (sha256_hex, resolved_path).
    """
    sha = _sha256(data)
    prefix = sha[:2]
    dest_dir = Path(settings.storage_root) / "uploads" / prefix / sha
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / original_filename
    if not dest.exists():
        dest.write_bytes(data)
    return sha, dest


def incident_dir(incident_id: str) -> Path:
    p = Path(settings.storage_root) / "incidents" / incident_id
    p.mkdir(parents=True, exist_ok=True)
    return p


def incident_subdir(incident_id: str, sub: str) -> Path:
    p = incident_dir(incident_id) / sub
    p.mkdir(parents=True, exist_ok=True)
    return p


def write_incident_json(incident_id: str, filename: str, data: str) -> Path:
    p = incident_dir(incident_id) / filename
    p.write_text(data, encoding="utf-8")
    return p


def read_incident_json(incident_id: str, filename: str) -> str | None:
    p = incident_dir(incident_id) / filename
    if p.exists():
        return p.read_text(encoding="utf-8")
    return None
