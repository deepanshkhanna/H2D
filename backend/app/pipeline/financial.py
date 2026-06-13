"""
Financial Engine — dedicated, single-source-of-truth financial calculator.

Extracts:
  - invoice_total       → largest monetary amount from invoice
  - billed_units        → units shown in invoice
  - received_units      → units customer says arrived
  - damaged_units       → units reported damaged/unusable
  - missing_units       → billed - received (shortage)
  - unit_price          → invoice_total / billed_units
  - estimated_loss      → missing_units * unit_price  (or damaged_units * unit_price)
  - currency            → INR / USD / EUR / GBP

No calculation is duplicated elsewhere.  All downstream modules must import
compute_financials() and use the returned dict.
"""

from __future__ import annotations

import re
from typing import Any


# ─── Unit quantity patterns ───────────────────────────────────────────────────

BILLED_PATTERNS = [
    # "qty: 100" or "quantity: 100"
    r"(?:qty|quantity)\s*:?\s*(\d+)\b",
    # "100 units shipped", "100 pcs", "Quantity 100"
    r"(\d+)\s*(?:units?|pcs|pieces?|cartons?|boxes?|items?)\s+(?:shipped|dispatched|billed|invoiced)\b",
    r"(\d+)\s*(?:units?|pcs|pieces?|cartons?|boxes?|items?)\b",
    # Table format: "100  ₹2,400"
    r"\b(\d{1,5})\s+(?:₹|\$|EUR|INR|Rs\.?)\s*[\d,]+(?:\.\d{2})?",
]

# "However only 80 units were found inside" → received_units=80
# "only 80 units found" → 80
RECEIVED_PATTERNS = [
    # "only 80 units were found"
    r"only\s+(\d+)\s*(?:units?|pcs|pieces?|cartons?|boxes?|items?)?\s+(?:were\s+)?found\b",
    # "received only 80 units"
    r"received\s+(?:only\s+)?(\d+)\s*(?:units?|pcs|pieces?|cartons?|boxes?|items?)\b",
    # "only 80 units received"
    r"only\s+(\d+)\s*(?:units?|pcs|pieces?|cartons?|boxes?|items?)\s+(?:were\s+)?received\b",
    # "80 units received intact"
    r"(\d+)\s*(?:units?|pcs|pieces?)?\s+(?:were\s+)?received\s+intact\b",
    # "80 usable units"
    r"(\d+)\s*(?:units?|pcs|pieces?)?\s+(?:are\s+)?usable\b",
    # "usable: 80" or "usable units: 80"
    r"usable\s*(?:units?)?\s*:?\s*(\d+)\b",
    # "90 units are usable"
    r"(\d+)\s*(?:units?|pcs|pieces?)\s+are\s+usable\b",
]

DAMAGED_PATTERNS = [
    # "10 units are damaged"
    r"(\d+)\s*(?:units?|pcs|pieces?)?\s+(?:are\s+|were\s+)?(?:damaged|broken|unusable|spoiled|destroyed)\b",
    r"(?:damaged|broken|unusable|spoiled|destroyed)\s*(?:units?|pcs|pieces?)?\s*:?\s*(\d+)\b",
    r"(\d+)\s*(?:units?|pcs|pieces?)\s+damaged\b",
    r"(\d+)\s*(?:units?|pcs|pieces?)\s+broken\b",
]

MISSING_PATTERNS = [
    # "shortage of 20 units"
    r"shortage\s+of\s+(\d+)\s*(?:units?|pcs|pieces?)?\b",
    # "missing: 20" or "missing 20 units"
    r"missing\s*:?\s*(\d+)\s*(?:units?|pcs|pieces?)?\b",
    # "20 units are missing" or "20 units missing"
    r"(\d+)\s*(?:units?|pcs|pieces?)?\s+(?:are\s+|were\s+)?missing\b",
    # "short by 20"
    r"short\s+by\s+(\d+)\s*(?:units?|pcs|pieces?)?\b",
    # "20 units not received" or "20 units not found"
    r"(\d+)\s*(?:units?|pcs|pieces?)?\s+not\s+(?:received|found)\b",
    # Subject line: "Shortage in Shipment" + number somewhere
]

AMOUNT_PATTERNS = [
    # ₹240,000 or INR 240000 or Rs. 240,000
    r"(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)\b",
    # 240,000 INR
    r"([\d,]+(?:\.\d{1,2})?)\s*(?:INR|inr)\b",
    # $240,000 or USD 240,000
    r"(?:\$|USD)\s*([\d,]+(?:\.\d{1,2})?)\b",
    # €240,000 or EUR
    r"(?:€|EUR)\s*([\d,]+(?:\.\d{1,2})?)\b",
    # £240,000 or GBP
    r"(?:£|GBP)\s*([\d,]+(?:\.\d{1,2})?)\b",
    # Generic "Total: 240000" or "Amount: 240,000" or "Grand Total: 240000"
    r"(?:total|amount|grand\s+total|invoice\s+total)\s*:?\s*(?:₹|\$|INR|Rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)\b",
    # "240,000.00" standalone large numbers (invoice amounts)
    r"\b(\d{1,3}(?:,\d{3})+(?:\.\d{2})?)\b",
]


def _first_match(patterns: list[str], text: str) -> int | None:
    """Return the first integer match from any pattern against text."""
    # Normalize carriage returns
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    for pattern in patterns:
        m = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        if m:
            try:
                # Get last non-None group
                grp = next(
                    (m.group(i) for i in range(m.lastindex or 1, 0, -1) if m.group(i)),
                    m.group(0)
                )
                raw = grp.replace(",", "").strip()
                val = int(float(raw))
                if val > 0:
                    return val
            except (ValueError, AttributeError, IndexError):
                continue
    return None


def _all_amounts(text: str) -> list[float]:
    """Extract all monetary amounts from text."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    amounts: list[float] = []
    for pattern in AMOUNT_PATTERNS:
        for m in re.finditer(pattern, text, re.IGNORECASE | re.MULTILINE):
            try:
                grp = next(
                    (m.group(i) for i in range(m.lastindex or 1, 0, -1) if m.group(i)),
                    m.group(0)
                )
                raw = grp.replace(",", "").strip()
                val = float(raw)
                # Filter out small numbers (dates, quantities) — amounts usually > 100
                if val >= 100:
                    amounts.append(val)
            except (ValueError, AttributeError, IndexError):
                continue
    return amounts


def _detect_currency(invoice_text: str, email_text: str) -> str:
    """Detect the dominant currency from document text."""
    combined = invoice_text + " " + email_text
    if "₹" in combined or re.search(r"\bINR\b", combined) or re.search(r"\bRs\.?\b", combined):
        return "INR"
    if "€" in combined or re.search(r"\bEUR\b", combined):
        return "EUR"
    if "£" in combined or re.search(r"\bGBP\b", combined):
        return "GBP"
    return "USD"


def compute_financials(
    parsed: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """
    Single-source-of-truth financial computation.

    Args:
        parsed: dict of role → document dict (with 'text' key)

    Returns:
        Financial summary dict with all metrics.
    """
    invoice_text = parsed.get("invoice_pdf", {}).get("text", "")
    email_text = parsed.get("complaint_email", {}).get("text", "")
    image_doc = parsed.get("damage_image", {})

    currency = _detect_currency(invoice_text, email_text)

    # ── Invoice total ──────────────────────────────────────────────────────────
    amounts_in_invoice = _all_amounts(invoice_text)
    # Use max amount from invoice (likely the total)
    invoice_total = max(amounts_in_invoice) if amounts_in_invoice else 0.0

    # ── Billed units (from invoice) ────────────────────────────────────────────
    billed_units: int = _first_match(BILLED_PATTERNS, invoice_text) or 100

    # ── Received units (from complaint email) ──────────────────────────────────
    received_units: int | None = _first_match(RECEIVED_PATTERNS, email_text)

    # ── Damaged units (from complaint email) ───────────────────────────────────
    damaged_units: int = _first_match(DAMAGED_PATTERNS, email_text) or 0

    # ── Missing/shortage units (from complaint email) ──────────────────────────
    missing_units: int | None = _first_match(MISSING_PATTERNS, email_text)

    # ── Reconcile ─────────────────────────────────────────────────────────────
    if missing_units is not None and received_units is None:
        received_units = max(0, billed_units - missing_units)
    elif received_units is not None and missing_units is None:
        missing_units = max(0, billed_units - received_units)

    if received_units is None and missing_units is None:
        # Fall back to damaged units as proxy for shortage
        if damaged_units > 0:
            missing_units = damaged_units
            received_units = max(0, billed_units - missing_units)
        else:
            received_units = billed_units
            missing_units = 0

    missing_units = missing_units or 0
    received_units = received_units if received_units is not None else billed_units

    # Sanity check: missing_units cannot exceed billed_units
    if missing_units > billed_units:
        missing_units = billed_units
    if received_units > billed_units:
        received_units = billed_units

    # ── Unit price and loss ────────────────────────────────────────────────────
    unit_price = invoice_total / max(billed_units, 1) if invoice_total > 0 else 0.0

    # Loss = missing units * unit price
    # (if physical damage with no shortage, loss = damaged_units * unit_price)
    if missing_units > 0:
        estimated_loss = missing_units * unit_price
    elif damaged_units > 0:
        estimated_loss = damaged_units * unit_price
    else:
        estimated_loss = 0.0

    return {
        "currency": currency,
        "invoice_total": round(invoice_total, 2),
        "billed_units": billed_units,
        "received_units": received_units,
        "damaged_units": damaged_units,
        "missing_units": missing_units,
        "unit_price": round(unit_price, 2),
        "estimated_loss": round(estimated_loss, 2),
        # Derived flags for routing
        "has_shortage": missing_units > 0,
        "has_physical_damage": damaged_units > 0 or image_doc.get("damage_detected", False),
        "shortage_rate": round(missing_units / max(billed_units, 1), 4),
    }
