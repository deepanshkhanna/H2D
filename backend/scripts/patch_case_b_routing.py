"""
Two surgical fixes:
1. gemini.py _report_fallback routing: when vision is PIL fallback AND fin_data has missing_units > 0,
   trust fin_data over vision for case type selection.
2. risk.py calibration: inventory shortage (PIL fallback + missing units) → 55-65 range.

Also: strengthen the Gemini live prompt with explicit case type hint.
"""
import sys, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def patch(filepath, name, old_snippet, new_snippet):
    raw = open(filepath, 'rb').read().decode('utf-8')
    old_crlf = old_snippet.replace('\n', '\r\n')
    new_crlf = new_snippet.replace('\n', '\r\n')
    if old_crlf in raw:
        raw = raw.replace(old_crlf, new_crlf, 1)
        open(filepath, 'wb').write(raw.encode('utf-8'))
        print(f'APPLIED {name}')
    else:
        print(f'WARNING {name}: pattern not found')
        first = old_crlf.split('\r\n')[0].strip()
        if first:
            idx = raw.find(first)
            if idx >= 0:
                print(f'  Hint: found first line at {idx}: {repr(raw[idx:idx+80])}')

GEMINI = '../backend/app/ai/gemini.py'
RISK   = '../backend/app/pipeline/risk.py'

# ============================================================
# FIX 1a: gemini.py — Case B routing uses fin_data as primary signal
# when vision result is from PIL fallback (not real Gemini)
# ============================================================
patch(GEMINI, 'FIX1-case-B-routing',
"""    elif (not damage_detected) or (shortage_units > 0 and damage_severity in (\"none\", \"low\") and (\"intact\" in email_text.lower() or \"intact\" in damage_labels.lower())):
        # Case B: Inventory Shortage (Box Intact)""",
"""    # ── Determine if vision result is from PIL fallback (unreliable) ──────────
    vision_is_fallback = image_doc.get(\"fallback\", False)
    # When fin_data has authoritative missing_units > 0 and vision is a PIL
    # fallback, trust the financial engine over the unreliable PIL detection.
    fin_missing = fin_data.get(\"missing_units\", 0) if fin_data else shortage_units
    fin_damaged = fin_data.get(\"damaged_units\", 0) if fin_data else damaged_units
    is_pure_shortage = (fin_missing > 0 and fin_damaged == 0)
    # Route to Case B if:
    # - Image is intact (real or fallback) OR
    # - Vision is a PIL fallback AND fin_data confirms shortage-only (no physical damage units)
    route_to_shortage = (
        (not damage_detected)
        or (shortage_units > 0 and damage_severity in (\"none\", \"low\") and (\"intact\" in email_text.lower() or \"intact\" in damage_labels.lower()))
        or (vision_is_fallback and is_pure_shortage and not has_timeline_anomaly)
    )
    elif route_to_shortage:
        # Case B: Inventory Shortage (Box Intact or Fallback Vision with Financial Confirmation)"""
)

# ============================================================
# FIX 1b: Fix the syntax error from the elif-after-assignment above
# Restructure the if/elif chain properly
# ============================================================
# Actually the above will create invalid Python (elif after assignment is syntax error).
# Let me redo it as a proper if/elif chain.

# The current structure in gemini.py at the routing point is:
#   if has_timeline_anomaly:
#       ...return Case C...
#   elif (not damage_detected) or ...:
#       ...return Case B...
#   else:
#       ...return Case A...
#
# We need to change the elif condition for Case B.
# The above patch may have created syntax issues. Let's check and apply the correct version.

print("\nApplying corrected routing fix...")

raw = open(GEMINI, 'rb').read().decode('utf-8')

# Check if the previous patch applied
if 'vision_is_fallback = image_doc.get' in raw:
    # Previous patch applied, but created syntax error (elif after variable assignment)
    # Fix: convert the variable block + elif into a proper combined condition
    bad_crlf = """    # ── Determine if vision result is from PIL fallback (unreliable) ──────────\r\n    vision_is_fallback = image_doc.get(\"fallback\", False)\r\n    # When fin_data has authoritative missing_units > 0 and vision is a PIL\r\n    # fallback, trust the financial engine over the unreliable PIL detection.\r\n    fin_missing = fin_data.get(\"missing_units\", 0) if fin_data else shortage_units\r\n    fin_damaged = fin_data.get(\"damaged_units\", 0) if fin_data else damaged_units\r\n    is_pure_shortage = (fin_missing > 0 and fin_damaged == 0)\r\n    # Route to Case B if:\r\n    # - Image is intact (real or fallback) OR\r\n    # - Vision is a PIL fallback AND fin_data confirms shortage-only (no physical damage units)\r\n    route_to_shortage = (\r\n        (not damage_detected)\r\n        or (shortage_units > 0 and damage_severity in (\"none\", \"low\") and (\"intact\" in email_text.lower() or \"intact\" in damage_labels.lower()))\r\n        or (vision_is_fallback and is_pure_shortage and not has_timeline_anomaly)\r\n    )\r\n    elif route_to_shortage:\r\n        # Case B: Inventory Shortage (Box Intact or Fallback Vision with Financial Confirmation)"""
    
    good_crlf = """    elif (\r\n        # Case B signals:\r\n        # 1. No damage detected at all\r\n        (not damage_detected)\r\n        # 2. Shortage with visually intact packaging\r\n        or (shortage_units > 0 and damage_severity in (\"none\", \"low\")\r\n            and (\"intact\" in email_text.lower() or \"intact\" in damage_labels.lower()))\r\n        # 3. PIL fallback vision (unreliable) + financial engine confirms pure shortage (no damaged units)\r\n        or (image_doc.get(\"fallback\", False)\r\n            and (fin_data.get(\"missing_units\", 0) if fin_data else shortage_units) > 0\r\n            and (fin_data.get(\"damaged_units\", 0) if fin_data else damaged_units) == 0\r\n            and not has_timeline_anomaly)\r\n    ):\r\n        # Case B: Inventory Shortage (Box Intact or Fallback Vision with Financial Confirmation)"""
    
    if bad_crlf in raw:
        raw = raw.replace(bad_crlf, good_crlf, 1)
        open(GEMINI, 'wb').write(raw.encode('utf-8'))
        print('APPLIED FIX1-corrected-routing')
    else:
        print('WARNING: Could not find bad patch to fix')
        # Try to find what's there
        idx = raw.find('vision_is_fallback')
        if idx >= 0:
            print(f'  Found at {idx}: {repr(raw[idx:idx+200])}')
else:
    # First patch didn't apply — apply the correct version directly
    old_crlf = """    elif (not damage_detected) or (shortage_units > 0 and damage_severity in (\"none\", \"low\") and (\"intact\" in email_text.lower() or \"intact\" in damage_labels.lower())):\r\n        # Case B: Inventory Shortage (Box Intact)"""
    
    new_crlf = """    elif (\r\n        # Case B signals:\r\n        # 1. No damage detected at all\r\n        (not damage_detected)\r\n        # 2. Shortage with visually intact packaging (confirmed by real Gemini vision)\r\n        or (shortage_units > 0 and damage_severity in (\"none\", \"low\")\r\n            and (\"intact\" in email_text.lower() or \"intact\" in damage_labels.lower()))\r\n        # 3. PIL fallback vision (unreliable) + financial engine confirms pure shortage (no damaged units)\r\n        or (image_doc.get(\"fallback\", False)\r\n            and (fin_data.get(\"missing_units\", 0) if fin_data else shortage_units) > 0\r\n            and (fin_data.get(\"damaged_units\", 0) if fin_data else damaged_units) == 0\r\n            and not has_timeline_anomaly)\r\n    ):\r\n        # Case B: Inventory Shortage (Box Intact or Fallback Vision with Financial Confirmation)"""
    
    if old_crlf in raw:
        raw = raw.replace(old_crlf, new_crlf, 1)
        open(GEMINI, 'wb').write(raw.encode('utf-8'))
        print('APPLIED FIX1-direct-routing')
    else:
        print('WARNING FIX1-direct: Case B elif not found')
        idx = raw.find('elif (not damage_detected)')
        print(f'  Search for elif: {idx}')
        idx2 = raw.find('Case B: Inventory')
        print(f'  Search for Case B comment: {idx2}')
        if idx2 >= 0:
            print(f'  Context: {repr(raw[max(0,idx2-100):idx2+100])}')

# ============================================================
# FIX 1c: Gemini LIVE prompt — inject deterministic case hint
# ============================================================
patch(GEMINI, 'FIX1c-prompt-case-hint',
"""        evidence_summary_parts.append(
            f\"FINANCIAL ENGINE: billed={fin_data['billed_units']} \"
            f\"received={fin_data['received_units']} \"
            f\"missing={fin_data['missing_units']} damaged={fin_data['damaged_units']} \"
            f\"unit_price={fin_data['unit_price']} \"
            f\"estimated_loss={fin_data['currency']} {fin_data['estimated_loss']:.2f}\"
        )""",
"""        evidence_summary_parts.append(
            f\"FINANCIAL ENGINE: billed={fin_data['billed_units']} \"
            f\"received={fin_data['received_units']} \"
            f\"missing={fin_data['missing_units']} damaged={fin_data['damaged_units']} \"
            f\"unit_price={fin_data['unit_price']} \"
            f\"estimated_loss={fin_data['currency']} {fin_data['estimated_loss']:.2f}\"
        )

        # Inject deterministic case-type hint based on financial engine + vision reliability
        _vision_doc = parsed.get(\"damage_image\", {})
        _vision_is_fallback = _vision_doc.get(\"fallback\", False)
        _missing = fin_data.get(\"missing_units\", 0) if fin_data else 0
        _damaged = fin_data.get(\"damaged_units\", 0) if fin_data else 0

        if _vision_is_fallback and _missing > 0 and _damaged == 0:
            evidence_summary_parts.append(
                \"\\nCASE TYPE DETERMINATION (DETERMINISTIC — DO NOT OVERRIDE):\\n\"
                f\"  Vision analysis used PIL fallback heuristic (NOT real Gemini vision) — UNRELIABLE.\\n\"
                f\"  Financial engine confirms: {_missing} units missing, 0 physically damaged units.\\n\"
                f\"  Packaging integrity CANNOT be confirmed from fallback vision.\\n\"
                f\"  MANDATORY CONCLUSION: Root cause is Warehouse Packing Error or Inventory Shrinkage.\\n\"
                f\"  Transit Damage is REJECTED because {_missing} units are missing with NO physical damage units confirmed by financial engine.\\n\"
                f\"  Your root_cause_hypotheses MUST rank Warehouse Packing Error first (confidence >= 0.85).\"
            )
        elif _missing > 0 and _damaged > 0:
            evidence_summary_parts.append(
                \"\\nCASE TYPE DETERMINATION (DETERMINISTIC):\\n\"
                f\"  Both missing ({_missing}) and physically damaged ({_damaged}) units confirmed.\\n\"
                f\"  Root cause is Transit Damage with Package Breach. Rank Transit Damage first.\"
            )"""
)

# ============================================================
# FIX 2: risk.py — Inventory shortage calibration
# PIL fallback damage → downgrade to shortage risk range (55-65)
# ============================================================
patch(RISK, 'FIX2-risk-calibration',
"""    elif shortage_units > 0 and not damage_detected:
        # Simple inventory shortage
        risk_score = 52.0""",
"""    elif shortage_units > 0 and not damage_detected:
        # Simple inventory shortage (confirmed no damage)
        risk_score = max(risk_score, 55.0)
        risk_score = min(risk_score, 68.0)  # Cap: shortage ≤ HIGH not CRITICAL
    elif shortage_units > 0 and damage_doc.get(\"fallback\", False) and damaged_units == 0:
        # Shortage with UNRELIABLE PIL fallback — treat as inventory shortage, not transit damage
        risk_score = max(risk_score, 58.0)
        risk_score = min(risk_score, 68.0)  # Cap at high, not critical"""
)

# ============================================================
# FIX 2b: risk.py — Transit damage with PIL fallback should not hit 78+ override
# ============================================================
patch(RISK, 'FIX2b-transit-damage-fallback',
"""    elif damage_detected and damage_severity >= 0.5 and financial_exposure > 0.3:
        # Severe logistics breach
        risk_score = max(risk_score, 78.0)""",
"""    elif damage_detected and damage_severity >= 0.5 and financial_exposure > 0.3 and not damage_doc.get(\"fallback\", False):
        # Severe logistics breach confirmed by REAL Gemini vision (not PIL fallback)
        risk_score = max(risk_score, 78.0)
    elif damage_detected and damage_severity >= 0.5 and financial_exposure > 0.3 and damage_doc.get(\"fallback\", False):
        # PIL fallback says damage — treat with less certainty
        risk_score = max(risk_score, 65.0)"""
)

print("\nAll patches done.")
