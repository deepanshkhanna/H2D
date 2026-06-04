"""
Risk scoring.

risk_score = clamp(
  35*evidence_strength + 25*damage_severity + 20*financial_exposure
  + 10*urgency + 10*inconsistency_penalty, 0, 100
)
"""

from __future__ import annotations

from typing import Any


DAMAGE_SEVERITY_MAP = {
    "critical": 1.0,
    "crushed_corner": 0.7,
    "water_damage": 0.8,
    "torn_packaging": 0.65,
    "missing_item": 0.9,
    "general_damage": 0.5,
    "none": 0.0,
}


def score_risk(
    links: dict[str, Any],
    canonical: dict[str, Any],
    parsed: dict[str, dict[str, Any]],
    incident_id: str,
) -> dict[str, Any]:
    edges = links.get("edges", [])
    entities: list[dict] = canonical.get("canonical", [])

    # Evidence strength: ratio of confirmed links
    total_edges = len(edges)
    confirmed = sum(1 for e in edges if e.get("status") == "confirmed")
    probable = sum(1 for e in edges if e.get("status") == "probable")
    evidence_strength = (confirmed + 0.5 * probable) / max(total_edges, 1)

    # Damage severity
    damage_obs = [e for e in entities if e.get("subtype") == "damage_observation"]
    severity_scores = [
        DAMAGE_SEVERITY_MAP.get(d.get("normalized_value", ""), 0.4)
        for d in damage_obs
    ]
    damage_severity = max(severity_scores) if severity_scores else 0.0

    # Financial exposure (normalize to 0-1 based on highest amount)
    amounts = [e for e in entities if e.get("subtype") == "amount"]
    max_amount = 0.0
    for amt in amounts:
        try:
            max_amount = max(max_amount, float(amt.get("normalized_value", "0").replace(",", "")))
        except (ValueError, TypeError):
            pass
    financial_exposure = min(max_amount / 50000, 1.0)  # Normalize to $50k

    # Urgency: presence of complaint email
    urgency = 1.0 if "complaint_email" in parsed else 0.3

    # Inconsistency penalty: contradicting edges
    contradictions = sum(1 for e in edges if e.get("type") == "contradicts")
    inconsistency_penalty = min(contradictions * 0.25, 1.0)

    raw = (
        35 * evidence_strength
        + 25 * damage_severity
        + 20 * financial_exposure
        + 10 * urgency
        + 10 * inconsistency_penalty
    )
    risk_score = max(0.0, min(100.0, raw))

    if risk_score >= 70:
        risk_label = "high"
    elif risk_score >= 40:
        risk_label = "medium"
    else:
        risk_label = "low"

    return {
        "risk_score": round(risk_score, 1),
        "risk_label": risk_label,
        "components": {
            "evidence_strength": round(evidence_strength, 3),
            "damage_severity": round(damage_severity, 3),
            "financial_exposure": round(financial_exposure, 3),
            "urgency": round(urgency, 3),
            "inconsistency_penalty": round(inconsistency_penalty, 3),
        },
        "incident_id": incident_id,
    }
