"""
OpsPilot AI - Interactive Console Demo & Integration Test.
Runs all three incident cases (Transit Damage, Inventory Shortage, Timeline Fraud)
through the full pipeline and displays a clean console dashboard of results.
"""

import os
import sys
import tempfile
import asyncio
from pathlib import Path

# Isolated environment configuration
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["STORAGE_ROOT"] = tempfile.mkdtemp()
os.environ["ENVIRONMENT"] = "development"
os.environ["OPSPILOT_API_KEYS"] = "test-key"

# Load Gemini key if available
env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if line.startswith("GEMINI_API_KEY="):
            os.environ["GEMINI_API_KEY"] = line.split("=", 1)[1].strip()
            break

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlmodel import SQLModel
from app.database import get_engine
from app.pipeline import parsers, extractor, normalizer, correlator, risk, graph_builder
from app.ai import gemini
from PIL import Image

def setup_files(case_name: str, invoice_text: str, email_text: str, is_intact: bool) -> tuple[str, str, str]:
    clean_name = case_name.lower().replace(":", "").replace(" ", "_")
    temp_dir = Path(os.environ["STORAGE_ROOT"]) / clean_name
    temp_dir.mkdir(parents=True, exist_ok=True)

    invoice_path = temp_dir / "invoice.pdf"
    invoice_path.write_text(invoice_text, encoding="utf-8")

    email_path = temp_dir / "complaint.eml"
    email_path.write_text(email_text, encoding="utf-8")

    image_name = "intact_box.jpg" if is_intact else "damaged_box.jpg"
    image_path = temp_dir / image_name
    img = Image.new("RGB", (200, 200), color=(0, 255, 0) if is_intact else (255, 0, 0))
    img.save(image_path)

    return str(invoice_path), str(email_path), str(image_path)

async def run_pipeline(case_name: str, inv_t: str, eml_t: str, is_intact: bool) -> dict:
    inv_p, eml_p, img_p = setup_files(case_name, inv_t, eml_t, is_intact)
    incident_id = f"incident-{case_name.lower().replace(' ', '-')}"
    job_id = f"job-{case_name.lower().replace(' ', '-')}"

    parsed = {
        "invoice_pdf": parsers.parse_pdf(inv_p, incident_id),
        "complaint_email": parsers.parse_email(eml_p, incident_id),
        "damage_image": await gemini.analyze_damage_image(img_p, incident_id)
    }

    entities = extractor.extract_entities(parsed, incident_id)
    canonical = normalizer.normalize_entities(entities, incident_id)
    links = correlator.score_links(canonical, parsed, incident_id)
    risk_data = risk.score_risk(links, canonical, parsed, incident_id)

    # Compile mock summary for report fallback if Gemini is rate-limited
    summary_parts = [f"INCIDENT: {case_name}"]
    report_data = await gemini.generate_investigation_report(
        "\n".join(summary_parts), parsed=parsed, canonical=canonical, links=links, risk_data=risk_data
    )

    graph = graph_builder.build_graph(
        job_id, incident_id, parsed, canonical, links, risk_data,
        [(d.get("sha256", ""), d.get("path", "")) for d in parsed.values()],
        report_data
    )

    return {
        "risk": risk_data,
        "report": report_data,
        "graph": graph,
        "parsed": parsed
    }

async def run_demo():
    print("=" * 80)
    print("                      OPSPILOT AI - CONSOLE DEMO & TEST CARD                   ")
    print("=" * 80)
    
    SQLModel.metadata.create_all(get_engine())

    # Case A: Transit Damage (10 units broken/damaged)
    invoice_a = (
        "Invoice Number: INV-2026-A1. Shipment ID: SHP-9001. Date: 2026-06-01.\n"
        "Billed amount: INR 2,40,000. 100 units of Electronics components at INR 2400 per unit."
    )
    email_a = (
        "Subject: Damage report for SHP-9001\n"
        "From: tech_buyer@delhitech.in\n"
        "Date: 2026-06-03\n\n"
        "We received shipment SHP-9001 on June 3. The package outer layer was crushed with caved corners "
        "and water stains on the box. Only 90 units were received intact, 10 units are broken and unusable."
    )

    # Case B: Inventory Shortage (20 units missing, box intact)
    invoice_b = (
        "Invoice Number: INV-2026-B1. Shipment ID: SHP-9002. Date: 2026-06-01.\n"
        "Billed amount: INR 2,40,000. 100 units of Electronics components at INR 2400 per unit."
    )
    email_b = (
        "Subject: Shortage shipment SHP-9002\n"
        "From: tech_buyer@delhitech.in\n"
        "Date: 2026-06-03\n\n"
        "We received shipment SHP-9002. The box is completely intact and undamaged. However, when we opened it, "
        "there were only 80 units inside. We have a shortage of 20 units."
    )

    # Case C: Chronological Timeline Fraud (complaint filed before invoice date)
    invoice_c = (
        "Invoice Number: INV-2026-C1. Shipment ID: SHP-9003. Date: 2026-06-01.\n"
        "Billed amount: INR 2,40,000. 100 units of Electronics components at INR 2400 per unit."
    )
    email_c = (
        "Subject: Damaged parts SHP-9003\n"
        "From: tech_buyer@delhitech.in\n"
        "Date: 2026-05-28\n\n"
        "We are filing a complaint regarding Shipment SHP-9003. The box arrived torn."
    )

    cases = [
        ("Case A: Transit Damage", invoice_a, email_a, False),
        ("Case B: Inventory Shortage", invoice_b, email_b, True),
        ("Case C: Timeline Fraud Anomaly", invoice_c, email_c, False)
    ]

    for name, inv, eml, intact in cases:
        print(f"\n[RUNNING] {name}...")
        res = await run_pipeline(name, inv, eml, intact)
        
        risk_score = res["risk"]["risk_score"]
        risk_label = res["risk"]["risk_label"]
        evidence_strength = res["risk"]["components"]["evidence_strength"]
        inconsistency_penalty = res["risk"]["components"]["inconsistency_penalty"]
        
        report = res["report"]
        loss = report["financial_impact"]["estimated_loss"]
        currency = report["financial_impact"]["currency"]
        breakdown = report["financial_impact"]["breakdown"]
        root_cause = report["root_cause_hypotheses"][0]["hypothesis"]
        best_explanation = report.get("best_explanation", "N/A")
        
        edges = res["graph"].edges
        confirmed = sum(1 for e in edges if e.status.value == "confirmed")
        contradicts = sum(1 for e in edges if e.type.value == "contradicts")
        
        print(f"\n\033[1;36m+--- {name.upper()} RESULTS ---+\033[0m")
        print(f"|  * Composite Risk Score : {risk_score}/100 ({risk_label.upper()})")
        print(f"|  * Evidence Strength    : {evidence_strength:.2f}")
        print(f"|  * Inconsistency Penalty : {inconsistency_penalty:.2f}")
        print(f"|  * Financial Impact     : {currency} {loss:,.2f} ({breakdown})")
        print(f"|  * Primary Root Cause   : {root_cause}")
        print(f"|  * Graph Connections    : Total: {len(edges)}, Confirmed: {confirmed}, Contradicts: {contradicts}")
        print(f"|  * Best Explanation     : {best_explanation[:120]}...")
        print("+" + "-"*40 + "+")

    print("\n" + "=" * 80)
    print("                             DEMO COMPLETED SUCCESSFULLY                       ")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(run_demo())
