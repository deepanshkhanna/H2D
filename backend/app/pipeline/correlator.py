"""
Hybrid correlation engine.
Computes weighted confidence scores for all candidate cross-document links.

Confidence formula (from Plan.md):
  final = 0.40*identifier_score + 0.15*party_score + 0.10*temporal_score
        + 0.20*semantic_damage_score + 0.10*vision_text_score
        + 0.05*model_adjudication_score

Thresholds:
  >= 0.85 → confirmed
  0.65-0.84 → probable
  0.50-0.64 → weak
  < 0.50 → rejected
"""

from __future__ import annotations

import uuid
from typing import Any

WEIGHTS = {
    "identifier_score": 0.40,
    "party_score": 0.15,
    "temporal_score": 0.10,
    "semantic_damage_score": 0.20,
    "vision_text_score": 0.10,
    "model_adjudication_score": 0.05,
}


def _edge_status(confidence: float) -> str:
    if confidence >= 0.85:
        return "confirmed"
    if confidence >= 0.65:
        return "probable"
    if confidence >= 0.50:
        return "weak"
    return "rejected"


def _edge_decision(status: str) -> str:
    return {"confirmed": "accept", "probable": "warn", "weak": "hide", "rejected": "reject"}.get(status, "hide")


def score_links(
    canonical: dict[str, Any],
    parsed: dict[str, dict[str, Any]],
    incident_id: str,
) -> dict[str, Any]:
    """
    Build candidate edges between canonical entities across documents.
    Returns edges list with confidence breakdowns.
    """
    entities: list[dict] = canonical.get("canonical", [])
    source_refs: list[dict] = canonical.get("source_refs", [])

    edges: list[dict] = []

    # Group entities by subtype
    by_subtype: dict[str, list[dict]] = {}
    for ent in entities:
        st = ent["subtype"]
        by_subtype.setdefault(st, []).append(ent)

    # ── Cross-document shipment ID matching ──────────────────────────────────
    shipment_ids = by_subtype.get("shipment_id", [])
    for i, a in enumerate(shipment_ids):
        for b in shipment_ids[i + 1:]:
            doc_a = {m["document_id"] for m in a.get("mentions", [])}
            doc_b = {m["document_id"] for m in b.get("mentions", [])}
            if doc_a & doc_b:  # Same doc, skip
                continue
            # They match (normalizer already grouped identical IDs)
            components = {
                "identifier_score": 1.0,
                "party_score": 0.0,
                "temporal_score": 0.0,
                "semantic_damage_score": 0.0,
                "vision_text_score": 0.0,
                "model_adjudication_score": 0.0,
            }
            _score_edge(a, b, components, edges, incident_id, source_refs)

    # ── Damage observation cross-doc links ───────────────────────────────────
    damage_obs = by_subtype.get("damage_observation", [])
    by_damage_type: dict[str, list[dict]] = {}
    for d in damage_obs:
        dt = d.get("normalized_value", "unknown")
        by_damage_type.setdefault(dt, []).append(d)

    for damage_type, group in by_damage_type.items():
        if len(group) < 2:
            continue
        for i, a in enumerate(group):
            for b in group[i + 1:]:
                doc_a = {m["document_id"] for m in a.get("mentions", [])}
                doc_b = {m["document_id"] for m in b.get("mentions", [])}
                if doc_a & doc_b:
                    continue
                # Check if one comes from vision, one from text
                methods_a = {m.get("method") for m in a.get("mentions", [])}
                methods_b = {m.get("method") for m in b.get("mentions", [])}
                vision_text = bool(
                    ("vision" in methods_a and "keyword" in methods_b)
                    or ("keyword" in methods_a and "vision" in methods_b)
                )
                components = {
                    "identifier_score": 0.0,
                    "party_score": 0.0,
                    "temporal_score": 0.0,
                    "semantic_damage_score": 0.90,
                    "vision_text_score": 0.85 if vision_text else 0.0,
                    "model_adjudication_score": 0.0,
                }
                _score_edge(a, b, components, edges, incident_id, source_refs,
                            edge_type="correlates_with",
                            label=f"Both report: {damage_type.replace('_', ' ')}")

    # ── Corroborate: shipment entity → damage observation ────────────────────
    for shp in shipment_ids:
        for dmg in damage_obs:
            doc_shp = {m["document_id"] for m in shp.get("mentions", [])}
            doc_dmg = {m["document_id"] for m in dmg.get("mentions", [])}
            if not (doc_shp - doc_dmg):
                continue  # Skip if damage is only in same doc as shipment
            components = {
                "identifier_score": 0.70,
                "party_score": 0.0,
                "temporal_score": 0.0,
                "semantic_damage_score": 0.80,
                "vision_text_score": 0.0,
                "model_adjudication_score": 0.0,
            }
            _score_edge(
                shp, dmg, components, edges, incident_id, source_refs,
                edge_type="supports",
                label=f"{shp['label']} linked to {dmg['normalized_value'].replace('_', ' ')}",
            )

    confirmed_count = sum(1 for e in edges if e.get("status") == "confirmed")
    return {
        "edges": edges,
        "confirmed_count": confirmed_count,
        "source_refs": source_refs,
        "incident_id": incident_id,
    }


def _score_edge(
    a: dict,
    b: dict,
    components: dict[str, float],
    edges: list,
    incident_id: str,
    source_refs: list,
    edge_type: str = "same_as",
    label: str | None = None,
):
    final = sum(components[k] * WEIGHTS[k] for k in WEIGHTS)
    status = _edge_status(final)
    decision = _edge_decision(status)

    evidence_refs = list(set(a.get("source_ref_ids", []) + b.get("source_ref_ids", [])))

    edge = {
        "id": str(uuid.uuid4()),
        "source": a["id"],
        "target": b["id"],
        "type": edge_type,
        "label": label or f"{a['label']} ↔ {b['label']}",
        "confidence": round(final, 4),
        "status": status,
        "evidence_ref_ids": evidence_refs,
        "confidence_breakdown": {
            "final": round(final, 4),
            "threshold": 0.65,
            "decision": decision,
            "components": components,
            "weights": WEIGHTS,
            "calibration_note": "Deterministic scoring; model adjudication not applied" if components["model_adjudication_score"] == 0 else "",
        },
        "metadata": {"incident_id": incident_id},
    }
    edges.append(edge)
