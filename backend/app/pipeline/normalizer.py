"""
Entity normalization — groups mentions of the same real-world entity
into canonical entities using fuzzy matching on normalized values.
"""

from __future__ import annotations

import uuid
from typing import Any


def _normalize_shipment_id(value: str) -> str:
    """Strip spaces/punctuation, uppercase."""
    return value.upper().replace(" ", "").replace("-", "").replace("#", "").strip()


def _are_same_shipment(a: str, b: str) -> bool:
    na, nb = _normalize_shipment_id(a), _normalize_shipment_id(b)
    if na == nb:
        return True
    # One is a suffix of the other (e.g. SHP10488 vs 10488)
    if na.endswith(nb) or nb.endswith(na):
        return True
    return False


def _normalize_date(value: str) -> str:
    """Best-effort ISO date normalization."""
    import re
    value = value.strip()
    # YYYY-MM-DD or YYYY/MM/DD → keep
    m = re.match(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})", value)
    if m:
        return f"{m.group(1)}-{m.group(2).zfill(2)}-{m.group(3).zfill(2)}"
    # DD/MM/YYYY or MM/DD/YYYY → ambiguous, keep as-is
    return value


def normalize_entities(
    extraction: dict[str, Any],
    incident_id: str,
) -> dict[str, Any]:
    """
    Group mentions into canonical entities.
    Returns: {"canonical": [...], "source_refs": [...]}
    """
    mentions: list[dict] = extraction.get("mentions", [])
    source_refs: list[dict] = extraction.get("source_refs", [])

    canonical_map: dict[str, dict] = {}  # canonical_id → entity

    for mention in mentions:
        subtype = mention.get("subtype", "unknown")
        norm_val = mention.get("normalized_value", "")

        matched_id = None

        if subtype == "shipment_id":
            for cid, cent in canonical_map.items():
                if cent["subtype"] == "shipment_id" and _are_same_shipment(
                    cent["normalized_value"], norm_val
                ):
                    matched_id = cid
                    break

        elif subtype in ("date", "amount", "party", "damage_observation"):
            for cid, cent in canonical_map.items():
                if cent["subtype"] == subtype and cent["normalized_value"] == (
                    _normalize_date(norm_val) if subtype == "date" else norm_val
                ):
                    matched_id = cid
                    break

        if matched_id is None:
            # New canonical entity
            cid = str(uuid.uuid4())
            nv = _normalize_date(norm_val) if subtype == "date" else norm_val
            canonical_map[cid] = {
                "id": cid,
                "subtype": subtype,
                "normalized_value": nv,
                "label": nv[:60] if nv else "Unknown",
                "mentions": [],
                "source_ref_ids": [],
                "confidence": mention.get("confidence", 0.8),
            }
            matched_id = cid

        canonical_map[matched_id]["mentions"].append(mention)
        ref_id = mention.get("source_ref_id")
        if ref_id and ref_id not in canonical_map[matched_id]["source_ref_ids"]:
            canonical_map[matched_id]["source_ref_ids"].append(ref_id)

        # Boost confidence when same entity found in multiple docs
        doc_ids = {m.get("document_id") for m in canonical_map[matched_id]["mentions"]}
        if len(doc_ids) > 1:
            canonical_map[matched_id]["confidence"] = min(
                canonical_map[matched_id]["confidence"] + 0.05 * (len(doc_ids) - 1), 1.0
            )

    return {
        "canonical": list(canonical_map.values()),
        "source_refs": source_refs,
        "doc_ids": extraction.get("doc_ids", {}),
        "incident_id": incident_id,
    }
