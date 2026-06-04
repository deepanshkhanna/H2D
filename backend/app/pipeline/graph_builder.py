"""
Graph builder — assembles the final EvidenceGraph JSON from all
pipeline outputs. Creates document nodes, entity nodes, anomaly/risk
nodes, and wires up all edges.
"""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone
from typing import Any

from app.models import (
    EvidenceEdge,
    EvidenceGraph,
    EvidenceNode,
    EdgeStatus,
    EdgeType,
    Explanation,
    GraphMetadata,
    NodeType,
    RiskLabel,
    Severity,
    SourceRef,
    ConfidenceBreakdown,
    ConfidenceComponents,
)

ROLE_LABELS = {
    "invoice_pdf": "Invoice PDF",
    "complaint_email": "Complaint Email",
    "damage_image": "Damage Photo",
}

ROLE_DESCRIPTIONS = {
    "invoice_pdf": "Shipping invoice or bill of lading",
    "complaint_email": "Customer damage complaint",
    "damage_image": "Physical damage photograph",
}

SUBTYPE_NODE_TYPE = {
    "shipment_id": NodeType.entity,
    "date": NodeType.entity,
    "amount": NodeType.entity,
    "party": NodeType.entity,
    "damage_observation": NodeType.observation,
}

DAMAGE_SEVERITY_MAP = {
    "missing_item": Severity.high,
    "water_damage": Severity.high,
    "crushed_corner": Severity.medium,
    "torn_packaging": Severity.medium,
    "general_damage": Severity.low,
}


def build_graph(
    job_id: str,
    incident_id: str,
    parsed: dict[str, dict[str, Any]],
    canonical: dict[str, Any],
    links: dict[str, Any],
    risk_data: dict[str, Any],
    stored_files: list[tuple[str, str]],  # list of (sha256, path)
) -> EvidenceGraph:
    nodes: list[EvidenceNode] = []
    edges: list[EvidenceEdge] = []
    source_refs_out: list[SourceRef] = []

    doc_ids: dict[str, str] = canonical.get("doc_ids", {})
    source_refs_raw: list[dict] = canonical.get("source_refs", [])

    # ── Convert raw source refs ───────────────────────────────────────────────
    sref_map: dict[str, SourceRef] = {}
    for sr in source_refs_raw:
        obj = SourceRef(
            id=sr["id"],
            document_id=sr["document_id"],
            kind=sr.get("kind", "text_span"),
            page=sr.get("page"),
            text=sr.get("text", "")[:500],
            char_start=sr.get("char_start"),
            char_end=sr.get("char_end"),
            bbox=sr.get("bbox"),
            hash=sr.get("hash", ""),
        )
        sref_map[obj.id] = obj
        source_refs_out.append(obj)

    # ── Document nodes ────────────────────────────────────────────────────────
    doc_node_map: dict[str, str] = {}  # role → node_id

    for role, doc in parsed.items():
        doc_id = doc_ids.get(role, str(uuid.uuid4()))
        node_id = f"doc_{doc_id}"
        doc_node_map[role] = node_id

        node = EvidenceNode(
            id=node_id,
            type=NodeType.document,
            subtype=role,
            label=ROLE_LABELS.get(role, role),
            description=ROLE_DESCRIPTIONS.get(role),
            confidence=1.0,
            source_ref_ids=[],
            data={
                "document_type": role,
                "filename": str(doc.get("path", "")).split("\\")[-1].split("/")[-1],
                "parser": doc.get("parser", "unknown"),
                "page_count": doc.get("page_count"),
                "sha256": doc.get("sha256", ""),
            },
        )
        nodes.append(node)

    # ── Entity nodes ──────────────────────────────────────────────────────────
    canonical_entities: list[dict] = canonical.get("canonical", [])
    entity_node_map: dict[str, str] = {}  # canonical_id → node_id

    for ent in canonical_entities:
        eid = ent["id"]
        subtype = ent.get("subtype", "unknown")
        node_type = SUBTYPE_NODE_TYPE.get(subtype, NodeType.entity)

        severity = None
        if subtype == "damage_observation":
            severity = DAMAGE_SEVERITY_MAP.get(ent.get("normalized_value", ""), Severity.low)

        # Count which docs this entity appears in
        doc_roles = list({
            m.get("role") for m in ent.get("mentions", []) if m.get("role")
        })

        node_id = f"ent_{eid[:12]}"
        entity_node_map[eid] = node_id

        node = EvidenceNode(
            id=node_id,
            type=node_type,
            subtype=subtype,
            label=ent.get("label", ent.get("normalized_value", "?"))[:60],
            confidence=ent.get("confidence", 0.8),
            severity=severity,
            source_ref_ids=ent.get("source_ref_ids", []),
            data={
                "normalized_value": ent.get("normalized_value", ""),
                "mention_count": len(ent.get("mentions", [])),
                "document_roles": doc_roles,
                "cross_doc": len(set(
                    m.get("document_id") for m in ent.get("mentions", [])
                )) > 1,
            },
        )
        nodes.append(node)

        # Wire document → entity edges (contains)
        for mention in ent.get("mentions", []):
            for role, did in doc_ids.items():
                if mention.get("document_id") == did:
                    doc_nid = doc_node_map.get(role)
                    if doc_nid:
                        edges.append(EvidenceEdge(
                            id=f"e_contains_{doc_nid}_{node_id}_{mention['id'][:8]}",
                            source=doc_nid,
                            target=node_id,
                            type=EdgeType.contains,
                            label="contains",
                            confidence=mention.get("confidence", 0.85),
                            status=EdgeStatus.confirmed,
                            evidence_ref_ids=[mention.get("source_ref_id", "")],
                        ))

    # ── Correlation edges (from correlator) ───────────────────────────────────
    raw_edges: list[dict] = links.get("edges", [])
    for re_dict in raw_edges:
        src_eid = re_dict.get("source")
        tgt_eid = re_dict.get("target")
        src_nid = entity_node_map.get(src_eid or "")
        tgt_nid = entity_node_map.get(tgt_eid or "")
        if not src_nid or not tgt_nid:
            continue

        bd_raw = re_dict.get("confidence_breakdown", {})
        comp_raw = bd_raw.get("components", {})
        breakdown = ConfidenceBreakdown(
            final=re_dict.get("confidence", 0.0),
            threshold=bd_raw.get("threshold", 0.65),
            decision=bd_raw.get("decision", "hide"),
            components=ConfidenceComponents(**{
                k: comp_raw.get(k, 0.0) for k in ConfidenceComponents.model_fields
            }),
            weights=bd_raw.get("weights", {}),
            calibration_note=bd_raw.get("calibration_note", ""),
        )

        edge = EvidenceEdge(
            id=re_dict["id"],
            source=src_nid,
            target=tgt_nid,
            type=EdgeType(re_dict.get("type", "correlates_with")),
            label=re_dict.get("label", ""),
            confidence=re_dict.get("confidence", 0.0),
            status=EdgeStatus(re_dict.get("status", "weak")),
            evidence_ref_ids=re_dict.get("evidence_ref_ids", []),
            confidence_breakdown=breakdown,
        )
        edges.append(edge)

    # ── Risk node ─────────────────────────────────────────────────────────────
    risk_score = risk_data.get("risk_score", 0.0)
    risk_label = risk_data.get("risk_label", "low")
    risk_node_id = f"risk_{incident_id[:12]}"

    risk_node = EvidenceNode(
        id=risk_node_id,
        type=NodeType.risk,
        label=f"{risk_label.upper()} RISK",
        description=f"Composite risk score: {risk_score:.0f}/100",
        confidence=1.0,
        data={
            "risk_score": risk_score,
            "risk_label": risk_label,
            **risk_data.get("components", {}),
        },
    )
    nodes.append(risk_node)

    # Link anomaly/observation nodes to risk node
    anomaly_nodes = [n for n in nodes if n.type in (NodeType.anomaly, NodeType.observation)]
    for an in anomaly_nodes:
        edges.append(EvidenceEdge(
            id=f"e_risk_{an.id}",
            source=an.id,
            target=risk_node_id,
            type=EdgeType.causes_risk,
            label="contributes to risk",
            confidence=an.confidence,
            status=EdgeStatus.probable if an.confidence >= 0.65 else EdgeStatus.weak,
            evidence_ref_ids=an.source_ref_ids,
        ))

    # ── Explanations ──────────────────────────────────────────────────────────
    damage_types = list({
        ent.get("normalized_value", "")
        for ent in canonical_entities
        if ent.get("subtype") == "damage_observation"
    })
    shipment_ids = [
        ent.get("normalized_value", "")
        for ent in canonical_entities
        if ent.get("subtype") == "shipment_id"
    ]
    confirmed_edges = [e for e in edges if e.status == EdgeStatus.confirmed]
    probable_edges = [e for e in edges if e.status == EdgeStatus.probable]

    why_lines = []
    if shipment_ids:
        why_lines.append(f"Shipment ID(s) {', '.join(shipment_ids[:3])} found in multiple documents.")
    if damage_types:
        why_lines.append(f"Damage types corroborated: {', '.join(d.replace('_', ' ') for d in damage_types[:4])}.")
    if confirmed_edges:
        why_lines.append(f"{len(confirmed_edges)} high-confidence cross-document links established.")
    if probable_edges:
        why_lines.append(f"{len(probable_edges)} probable link(s) require manual review.")

    uncertainty = []
    if not shipment_ids:
        uncertainty.append("No shipment identifier found — entity matching may be incomplete.")
    if not damage_types:
        uncertainty.append("No damage description detected in documents.")

    recommended_action = (
        "Escalate for immediate investigation — high damage severity and financial exposure." if risk_label == "high"
        else "Flag for supervisor review — moderate evidence of damage claim." if risk_label == "medium"
        else "Archive incident — low risk, standard processing applies."
    )

    explanation = Explanation(
        incident_id=incident_id,
        summary=_build_summary(shipment_ids, damage_types, risk_score, risk_label),
        why=why_lines,
        uncertainty=uncertainty,
        recommended_action=recommended_action,
        risk_score=risk_score,
        risk_label=RiskLabel(risk_label),
    )

    # Attach explanation to most confident correlation edge
    if confirmed_edges:
        confirmed_edges[0].explanation_id = explanation.id

    # ── Metadata ──────────────────────────────────────────────────────────────
    input_hash = hashlib.sha256(
        "".join(sorted([sha for sha, _ in stored_files])).encode()
    ).hexdigest()[:16]

    metadata = GraphMetadata(
        incident_id=incident_id,
        job_id=job_id,
        created_at=datetime.now(timezone.utc).isoformat(),
        input_hash=input_hash,
        pipeline_versions={"graph_builder": "1.0.0", "correlator": "1.0.0"},
    )

    return EvidenceGraph(
        metadata=metadata,
        nodes=nodes,
        edges=edges,
        source_refs=source_refs_out,
        explanations=[explanation],
    )


def _build_summary(
    shipment_ids: list[str],
    damage_types: list[str],
    risk_score: float,
    risk_label: str,
) -> str:
    parts = []
    if shipment_ids:
        parts.append(f"Incident involving shipment {shipment_ids[0]}")
    else:
        parts.append("Incident")
    if damage_types:
        readable = [d.replace("_", " ") for d in damage_types[:2]]
        parts.append(f"with reported {' and '.join(readable)}")
    parts.append(f"— assessed as {risk_label.upper()} risk ({risk_score:.0f}/100).")
    return " ".join(parts)
