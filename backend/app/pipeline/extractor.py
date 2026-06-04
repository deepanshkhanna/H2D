"""
Entity extraction — deterministic regex pass + optional Gemini LLM pass.
Extracts: shipment IDs, dates, amounts, parties, damage descriptions.
"""

from __future__ import annotations

import hashlib
import re
import uuid
from typing import Any

# ─── Regex patterns ───────────────────────────────────────────────────────────

SHIPMENT_ID_PATTERNS = [
    re.compile(r"\bSHP[-\s]?\d{4,8}\b", re.IGNORECASE),
    re.compile(r"\b[A-Z]{2,4}[-\s]?\d{5,10}\b"),
    re.compile(r"\bOrder\s+(?:ID|No\.?|#)\s*:?\s*([A-Z0-9\-]{5,20})\b", re.IGNORECASE),
    re.compile(r"\bShipment\s+(?:ID|No\.?|#)\s*:?\s*([A-Z0-9\-]{5,20})\b", re.IGNORECASE),
    re.compile(r"\bTracking\s+(?:No\.?|#|Number)\s*:?\s*([A-Z0-9\-]{8,30})\b", re.IGNORECASE),
    re.compile(r"\bInvoice\s+(?:No\.?|#)\s*:?\s*([A-Z0-9\-]{4,20})\b", re.IGNORECASE),
]

DATE_PATTERNS = [
    re.compile(r"\b(\d{4}[-/]\d{2}[-/]\d{2})\b"),
    re.compile(r"\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b"),
    re.compile(r"\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b", re.IGNORECASE),
]

AMOUNT_PATTERNS = [
    re.compile(r"\$\s*(\d[\d,]*\.?\d*)\b"),
    re.compile(r"\b(\d[\d,]*\.?\d*)\s*(?:USD|INR|EUR|GBP)\b", re.IGNORECASE),
    re.compile(r"\bAmount\s*:?\s*\$?\s*(\d[\d,]*\.?\d*)\b", re.IGNORECASE),
    re.compile(r"\bTotal\s*:?\s*\$?\s*(\d[\d,]*\.?\d*)\b", re.IGNORECASE),
]

PARTY_PATTERNS = [
    re.compile(r"\bFrom\s*:\s*(.+?)(?:\n|<)", re.IGNORECASE),
    re.compile(r"\bTo\s*:\s*(.+?)(?:\n|<)", re.IGNORECASE),
    re.compile(r"\bSeller\s*:\s*(.+?)(?:\n|,)", re.IGNORECASE),
    re.compile(r"\bBuyer\s*:\s*(.+?)(?:\n|,)", re.IGNORECASE),
    re.compile(r"\bVendor\s*:\s*(.+?)(?:\n|,)", re.IGNORECASE),
    re.compile(r"\bShipper\s*:\s*(.+?)(?:\n|,)", re.IGNORECASE),
    re.compile(r"\bConsignee\s*:\s*(.+?)(?:\n|,)", re.IGNORECASE),
]

DAMAGE_KEYWORDS = {
    "crushed_corner": ["crushed corner", "corner crushed", "box corner caved", "corner damage", "corner dented"],
    "water_damage": ["wet", "water stain", "soaked", "moisture damage", "water damaged", "damp"],
    "torn_packaging": ["torn", "ripped", "punctured", "packaging breach", "tear", "hole in packaging"],
    "missing_item": ["shortage", "missing", "not received", "partial delivery", "short shipped"],
    "general_damage": ["damaged", "broken", "cracked", "shattered", "defective", "spoiled"],
}


def _make_source_ref_id(doc_id: str, text: str, char_start: int) -> str:
    h = hashlib.sha256(f"{doc_id}:{char_start}:{text[:50]}".encode()).hexdigest()[:16]
    return f"sref_{h}"


def _extract_from_text(
    text: str,
    doc_id: str,
    role: str,
    mentions: list,
    source_refs: list,
):
    """Run all regex patterns against a text string."""

    # Shipment IDs
    for pattern in SHIPMENT_ID_PATTERNS:
        for m in pattern.finditer(text):
            value = m.group(1) if m.lastindex else m.group(0)
            value = value.strip()
            if len(value) < 4:
                continue
            sref_id = _make_source_ref_id(doc_id, value, m.start())
            source_refs.append({
                "id": sref_id,
                "document_id": doc_id,
                "kind": "text_span",
                "text": m.group(0)[:200],
                "char_start": m.start(),
                "char_end": m.end(),
                "hash": hashlib.sha256(value.encode()).hexdigest()[:16],
            })
            mentions.append({
                "id": str(uuid.uuid4()),
                "subtype": "shipment_id",
                "raw_value": m.group(0),
                "normalized_value": value.upper().replace(" ", "-"),
                "source_ref_id": sref_id,
                "document_id": doc_id,
                "role": role,
                "method": "regex",
                "confidence": 0.95,
            })

    # Dates
    for pattern in DATE_PATTERNS:
        for m in pattern.finditer(text):
            value = m.group(1)
            sref_id = _make_source_ref_id(doc_id, value, m.start())
            source_refs.append({
                "id": sref_id,
                "document_id": doc_id,
                "kind": "text_span",
                "text": value,
                "char_start": m.start(),
                "char_end": m.end(),
                "hash": hashlib.sha256(value.encode()).hexdigest()[:16],
            })
            mentions.append({
                "id": str(uuid.uuid4()),
                "subtype": "date",
                "raw_value": value,
                "normalized_value": value,
                "source_ref_id": sref_id,
                "document_id": doc_id,
                "role": role,
                "method": "regex",
                "confidence": 0.90,
            })

    # Amounts
    for pattern in AMOUNT_PATTERNS:
        for m in pattern.finditer(text):
            value = (m.group(1) if m.lastindex else m.group(0)).strip().replace(",", "")
            sref_id = _make_source_ref_id(doc_id, value, m.start())
            source_refs.append({
                "id": sref_id,
                "document_id": doc_id,
                "kind": "text_span",
                "text": m.group(0)[:100],
                "char_start": m.start(),
                "char_end": m.end(),
                "hash": hashlib.sha256(value.encode()).hexdigest()[:16],
            })
            mentions.append({
                "id": str(uuid.uuid4()),
                "subtype": "amount",
                "raw_value": m.group(0),
                "normalized_value": value,
                "source_ref_id": sref_id,
                "document_id": doc_id,
                "role": role,
                "method": "regex",
                "confidence": 0.88,
            })

    # Parties (limited to first few matches)
    for pattern in PARTY_PATTERNS:
        for m in list(pattern.finditer(text))[:3]:
            value = (m.group(1) if m.lastindex else m.group(0)).strip()[:100]
            if not value or len(value) < 3:
                continue
            sref_id = _make_source_ref_id(doc_id, value, m.start())
            source_refs.append({
                "id": sref_id,
                "document_id": doc_id,
                "kind": "text_span",
                "text": m.group(0)[:150],
                "char_start": m.start(),
                "char_end": m.end(),
                "hash": hashlib.sha256(value.encode()).hexdigest()[:16],
            })
            mentions.append({
                "id": str(uuid.uuid4()),
                "subtype": "party",
                "raw_value": value,
                "normalized_value": value,
                "source_ref_id": sref_id,
                "document_id": doc_id,
                "role": role,
                "method": "regex",
                "confidence": 0.80,
            })

    # Damage keywords
    text_lower = text.lower()
    for damage_type, keywords in DAMAGE_KEYWORDS.items():
        for kw in keywords:
            idx = text_lower.find(kw)
            if idx != -1:
                snippet = text[max(0, idx - 20): idx + len(kw) + 40]
                sref_id = _make_source_ref_id(doc_id, kw, idx)
                source_refs.append({
                    "id": sref_id,
                    "document_id": doc_id,
                    "kind": "text_span",
                    "text": snippet[:200],
                    "char_start": idx,
                    "char_end": idx + len(kw),
                    "hash": hashlib.sha256(snippet.encode()).hexdigest()[:16],
                })
                mentions.append({
                    "id": str(uuid.uuid4()),
                    "subtype": "damage_observation",
                    "raw_value": kw,
                    "normalized_value": damage_type,
                    "source_ref_id": sref_id,
                    "document_id": doc_id,
                    "role": role,
                    "method": "keyword",
                    "confidence": 0.85,
                    "damage_type": damage_type,
                })
                break  # one match per damage type per doc


def extract_entities(
    parsed: dict[str, dict[str, Any]],
    incident_id: str,
) -> dict[str, Any]:
    """
    Extract entity mentions from all parsed documents.
    Returns: {"mentions": [...], "source_refs": [...], "doc_ids": {...}}
    """
    mentions: list[dict] = []
    source_refs: list[dict] = []
    doc_ids: dict[str, str] = {}

    for role, doc in parsed.items():
        doc_id = hashlib.sha256(
            f"{incident_id}:{role}".encode()
        ).hexdigest()[:16]
        doc_ids[role] = doc_id

        text = doc.get("text", "")
        if text:
            _extract_from_text(text, doc_id, role, mentions, source_refs)

        # Also extract from image analysis labels if present
        if role == "damage_image":
            labels = doc.get("labels", [])
            for label_info in labels:
                label = label_info.get("label", "") if isinstance(label_info, dict) else str(label_info)
                label_lower = label.lower()
                for damage_type, keywords in DAMAGE_KEYWORDS.items():
                    if any(kw in label_lower for kw in keywords):
                        sref_id = f"sref_vision_{hashlib.sha256(label.encode()).hexdigest()[:12]}"
                        source_refs.append({
                            "id": sref_id,
                            "document_id": doc_id,
                            "kind": "vision_label",
                            "text": label,
                            "hash": hashlib.sha256(label.encode()).hexdigest()[:16],
                        })
                        mentions.append({
                            "id": str(uuid.uuid4()),
                            "subtype": "damage_observation",
                            "raw_value": label,
                            "normalized_value": damage_type,
                            "source_ref_id": sref_id,
                            "document_id": doc_id,
                            "role": role,
                            "method": "vision",
                            "confidence": label_info.get("confidence", 0.80) if isinstance(label_info, dict) else 0.80,
                            "damage_type": damage_type,
                        })

    return {
        "mentions": mentions,
        "source_refs": source_refs,
        "doc_ids": doc_ids,
        "incident_id": incident_id,
    }
