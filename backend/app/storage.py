"""
Content-addressed local file storage.
Files are stored as: {storage_root}/uploads/{sha256[:2]}/{sha256}/{original_name}
"""

import hashlib
from pathlib import Path

from app.config import settings


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def store_upload(
    data: bytes,
    original_filename: str,
    incident_id: str | None = None,
    role: str | None = None,
    content_type: str | None = None,
):
    """
    Store raw bytes content-addressed.

    Compatibility behavior:
    - Legacy callers receive `(sha256_hex, resolved_path)`.
    - Durability callers passing `incident_id` + `role` receive an artifact dict.
    """
    sha = _sha256(data)
    # Sanitize filename to prevent path traversal
    safe_filename = Path(original_filename).name
    if not safe_filename:
        safe_filename = "unnamed"
    if incident_id and role:
        dest_dir = Path(settings.storage_root) / "uploads" / incident_id / role / sha
    else:
        prefix = sha[:2]
        dest_dir = Path(settings.storage_root) / "uploads" / prefix / sha
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / safe_filename
    if not dest.exists():
        dest.write_bytes(data)

    if incident_id and role:
        return {
            "incident_id": incident_id,
            "artifact_kind": "input",
            "role": role,
            "sha256": sha,
            "storage_backend": "local",
            "storage_path": str(dest),
            "content_type": content_type,
            "metadata": {"original_filename": original_filename},
        }

    return sha, dest


def materialize_artifact(incident_id: str, artifact: dict) -> Path:
    """Resolve a local artifact path for pipeline consumption."""
    _ = incident_id
    path = Path(artifact["storage_path"])
    if not path.exists():
        raise FileNotFoundError(f"Artifact not found: {path}")
    return path


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
