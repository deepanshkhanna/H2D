"""
Document parsers:
  - parse_pdf  → uses Docling first, falls back to PyMuPDF
  - parse_email → uses Python email module
"""

from __future__ import annotations

import email
import email.policy
import hashlib
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


# ─── PDF Parser ───────────────────────────────────────────────────────────────

def _parse_pdf_docling(path: str) -> dict[str, Any]:
    """Attempt to parse PDF with Docling for layout-aware markdown output."""
    from docling.document_converter import DocumentConverter  # type: ignore
    converter = DocumentConverter()
    result = converter.convert(path)
    doc = result.document
    markdown = doc.export_to_markdown()
    return {
        "parser": "docling",
        "text": markdown,
        "page_count": getattr(doc, "page_count", 1),
        "pages": [],
        "tables": [],
    }


def _parse_pdf_pymupdf(path: str) -> dict[str, Any]:
    """Parse PDF with PyMuPDF (fitz)."""
    import fitz  # type: ignore

    try:
        doc = fitz.open(path)
        full_text = ""
        pages = []
        for i, page in enumerate(doc):
            text = page.get_text("text")
            full_text += text + "\n"
            pages.append({
                "page": i + 1,
                "text": text,
                "width": page.rect.width,
                "height": page.rect.height,
            })
        return {
            "parser": "pymupdf",
            "text": full_text,
            "page_count": len(doc),
            "pages": pages,
            "tables": [],
        }
    except Exception as e:
        logger.warning("PyMuPDF failed to parse %s, trying plain text fallback: %s", path, e)
        try:
            text = Path(path).read_text(encoding="utf-8", errors="replace")
            return {
                "parser": "text_fallback",
                "text": text,
                "page_count": 1,
                "pages": [{"page": 1, "text": text}],
                "tables": [],
            }
        except Exception:
            raise e


def parse_pdf(path: str, incident_id: str) -> dict[str, Any]:
    """Parse PDF using Docling if available, else PyMuPDF."""
    base: dict[str, Any] = {
        "role": "invoice_pdf",
        "path": path,
        "sha256": _sha256_file(path),
        "incident_id": incident_id,
    }
    try:
        result = _parse_pdf_docling(path)
        logger.info("PDF parsed with docling: %s", path)
    except Exception as e:
        logger.warning("Docling failed (%s), falling back to PyMuPDF", e)
        result = _parse_pdf_pymupdf(path)

    base.update(result)
    return base


# ─── Email Parser ─────────────────────────────────────────────────────────────

def parse_email(path: str, incident_id: str) -> dict[str, Any]:
    """Parse email file (.eml / .txt / .html)."""
    raw = Path(path).read_bytes()
    sha = hashlib.sha256(raw).hexdigest()

    # Try Python email parser
    try:
        msg = email.message_from_bytes(raw, policy=email.policy.default)
        subject = str(msg.get("subject", ""))
        sender = str(msg.get("from", ""))
        recipient = str(msg.get("to", ""))
        date_str = str(msg.get("date", ""))

        body_parts: list[str] = []
        if msg.is_multipart():
            for part in msg.walk():
                ct = part.get_content_type()
                if ct in ("text/plain", "text/html"):
                    payload = part.get_payload(decode=True)
                    if payload:
                        body_parts.append(payload.decode("utf-8", errors="replace"))
        else:
            payload = msg.get_payload(decode=True)
            if payload:
                body_parts.append(payload.decode("utf-8", errors="replace"))

        body = "\n\n".join(body_parts)
        return {
            "role": "complaint_email",
            "path": path,
            "sha256": sha,
            "incident_id": incident_id,
            "parser": "email_module",
            "subject": subject,
            "sender": sender,
            "recipient": recipient,
            "date": date_str,
            "body": body,
            "text": f"Subject: {subject}\nFrom: {sender}\nTo: {recipient}\nDate: {date_str}\n\n{body}",
        }
    except Exception:
        # Plain text fallback
        text = raw.decode("utf-8", errors="replace")
        return {
            "role": "complaint_email",
            "path": path,
            "sha256": sha,
            "incident_id": incident_id,
            "parser": "plaintext",
            "subject": "",
            "sender": "",
            "recipient": "",
            "date": "",
            "body": text,
            "text": text,
        }


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _sha256_file(path: str) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()
