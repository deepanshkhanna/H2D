"""Unit tests for the deterministic correlation weights and extractor."""

from app.pipeline.correlator import WEIGHTS
from app.pipeline.extractor import extract_entities


def test_correlation_weights_sum_to_one():
    assert abs(sum(WEIGHTS.values()) - 1.0) < 1e-9


def test_extractor_finds_shipment_id():
    parsed = {
        "invoice_pdf": {
            "text": "Invoice for shipment SHP-10488. Total: $63,000. PO-9204.",
        }
    }
    result = extract_entities(parsed, incident_id="test-incident")
    labels = " ".join(
        f"{m.get('raw_value', '')} {m.get('normalized_value', '')}"
        for m in result["mentions"]
    ).upper()
    assert "SHP" in labels and "10488" in labels


def test_extractor_handles_empty_documents():
    result = extract_entities({"invoice_pdf": {"text": ""}}, incident_id="empty")
    assert result["mentions"] == []
