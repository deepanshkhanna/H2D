"""
Comprehensive patch for gemini.py:
1. Add fin_data parameter to generate_investigation_report
2. Add fin_data parameter to _report_fallback
3. Update _report_fallback to USE fin_data values instead of recalculating
4. Fix PIL fallback to use image heuristics to detect intact packages
5. Improve Case B routing to use fin_data
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

content = open('app/ai/gemini.py', 'rb').read().decode('utf-8')
changes = []

# ===== FIX 1: Add fin_data to generate_investigation_report signature =====
old_sig = (
    'async def generate_investigation_report(\r\n'
    '    evidence_summary_prompt: str,\r\n'
    '    parsed: dict[str, dict[str, Any]] | None = None,\r\n'
    '    canonical: dict[str, Any] | None = None,\r\n'
    '    links: dict[str, Any] | None = None,\r\n'
    '    risk_data: dict[str, Any] | None = None,\r\n'
    ') -> dict[str, Any]:'
)
new_sig = (
    'async def generate_investigation_report(\r\n'
    '    evidence_summary_prompt: str,\r\n'
    '    parsed: dict[str, dict[str, Any]] | None = None,\r\n'
    '    canonical: dict[str, Any] | None = None,\r\n'
    '    links: dict[str, Any] | None = None,\r\n'
    '    risk_data: dict[str, Any] | None = None,\r\n'
    '    fin_data: dict[str, Any] | None = None,\r\n'
    ') -> dict[str, Any]:'
)
if old_sig in content:
    content = content.replace(old_sig, new_sig, 1)
    changes.append('Added fin_data to generate_investigation_report signature')
else:
    print('WARNING: generate_investigation_report signature not found')

# ===== FIX 2: Pass fin_data to _report_fallback from no-key branch =====
old_nokey = (
    '    if not settings.gemini_api_key or settings.gemini_api_key == "your_gemini_api_key_here":\r\n'
    '        return _report_fallback(parsed, canonical, links, risk_data)'
)
new_nokey = (
    '    if not settings.gemini_api_key or settings.gemini_api_key == "your_gemini_api_key_here":\r\n'
    '        return _report_fallback(parsed, canonical, links, risk_data, fin_data=fin_data)'
)
if old_nokey in content:
    content = content.replace(old_nokey, new_nokey, 1)
    changes.append('Pass fin_data to _report_fallback (no-key branch)')
else:
    print('WARNING: no-key fallback branch not found')

# ===== FIX 3: Pass fin_data to _report_fallback from exception branch =====
old_exc = (
    '        logger.warning("Gemini report generation failed: %s \xe2\x80\x94 using fallback", e)\r\n'
    '        return _report_fallback(parsed, canonical, links, risk_data)'
)
new_exc = (
    '        logger.warning("Gemini report generation failed: %s \xe2\x80\x94 using fallback", e)\r\n'
    '        return _report_fallback(parsed, canonical, links, risk_data, fin_data=fin_data)'
)
if old_exc.encode() in content.encode():
    content = content.replace(
        '        logger.warning("Gemini report generation failed: %s \u2014 using fallback", e)\r\n'
        '        return _report_fallback(parsed, canonical, links, risk_data)',
        '        logger.warning("Gemini report generation failed: %s \u2014 using fallback", e)\r\n'
        '        return _report_fallback(parsed, canonical, links, risk_data, fin_data=fin_data)',
        1
    )
    changes.append('Pass fin_data to _report_fallback (exception branch)')
else:
    # Try alternate
    if 'return _report_fallback(parsed, canonical, links, risk_data)' in content:
        content = content.replace(
            'return _report_fallback(parsed, canonical, links, risk_data)',
            'return _report_fallback(parsed, canonical, links, risk_data, fin_data=fin_data)',
        )
        changes.append('Pass fin_data to _report_fallback (all branches)')
    else:
        print('WARNING: _report_fallback exception call not found')

# ===== FIX 4: Add fin_data parameter to _report_fallback function =====
old_fb_sig = (
    'def _report_fallback(\r\n'
    '    parsed: dict[str, dict[str, Any]] | None = None,\r\n'
    '    canonical: dict[str, Any] | None = None,\r\n'
    '    links: dict[str, Any] | None = None,\r\n'
    '    risk_data: dict[str, Any] | None = None,\r\n'
    ') -> dict[str, Any]:'
)
new_fb_sig = (
    'def _report_fallback(\r\n'
    '    parsed: dict[str, dict[str, Any]] | None = None,\r\n'
    '    canonical: dict[str, Any] | None = None,\r\n'
    '    links: dict[str, Any] | None = None,\r\n'
    '    risk_data: dict[str, Any] | None = None,\r\n'
    '    fin_data: dict[str, Any] | None = None,\r\n'
    ') -> dict[str, Any]:'
)
if old_fb_sig in content:
    content = content.replace(old_fb_sig, new_fb_sig, 1)
    changes.append('Added fin_data to _report_fallback signature')
else:
    print('WARNING: _report_fallback signature not found')

# ===== FIX 5: Replace the old financial calculation block with fin_data consumption =====
# The block that starts with "    unit_price = amount / max(billed_units, 1)"
old_fin_calc = (
    '    unit_price = amount / max(billed_units, 1)\r\n'
    '    loss_amount = shortage_units * unit_price'
)
new_fin_calc = (
    '    # Use fin_data from dedicated financial engine (if available)\r\n'
    '    if fin_data is not None:\r\n'
    '        billed_units = fin_data.get("billed_units", billed_units)\r\n'
    '        received_units = fin_data.get("received_units", received_units)\r\n'
    '        damaged_units = fin_data.get("damaged_units", damaged_units)\r\n'
    '        shortage_units = fin_data.get("missing_units", shortage_units or 0)\r\n'
    '        amount = fin_data.get("invoice_total", amount)\r\n'
    '        currency = fin_data.get("currency", currency)\r\n'
    '        unit_price = fin_data.get("unit_price", amount / max(billed_units, 1))\r\n'
    '        loss_amount = fin_data.get("estimated_loss", shortage_units * unit_price)\r\n'
    '    else:\r\n'
    '        unit_price = amount / max(billed_units, 1)\r\n'
    '        loss_amount = shortage_units * unit_price'
)
if old_fin_calc in content:
    content = content.replace(old_fin_calc, new_fin_calc, 1)
    changes.append('Replaced financial calculations with fin_data consumption')
else:
    print('WARNING: old financial calc block not found')

# ===== FIX 6: Fix PIL fallback to add image heuristics for intact detection =====
old_pil = (
    '    try:\r\n'
    '        from PIL import Image\r\n'
    '        img = Image.open(path)\r\n'
    '        w, h = img.size\r\n'
    '        return {\r\n'
    '            "damage_detected": True,\r\n'
    '            "labels": [\r\n'
    '                {"label": "damage visible", "confidence": 0.6, "location": "unknown"}\r\n'
    '            ],\r\n'
    '            "severity": "medium",\r\n'
    '            "damage_types": ["general_damage"],\r\n'
    '            "visible_text": [],\r\n'
    '            "summary": f"Damage image ({w}x{h}). Manual inspection required.",\r\n'
    '            "path": path,\r\n'
    '            "fallback": True,\r\n'
    '        }'
)
new_pil = (
    '    try:\r\n'
    '        from PIL import Image\r\n'
    '        import numpy as np\r\n'
    '        img = Image.open(path).convert("RGB")\r\n'
    '        w, h = img.size\r\n'
    '        arr = np.array(img)\r\n'
    '        # Heuristic: compute color variance and edge fraction\r\n'
    '        # Low variance + brown/cardboard tones = likely intact package\r\n'
    '        mean_r = float(arr[:,:,0].mean())\r\n'
    '        mean_g = float(arr[:,:,1].mean())\r\n'
    '        mean_b = float(arr[:,:,2].mean())\r\n'
    '        std_total = float(arr.std())\r\n'
    '        # Cardboard heuristic: brownish tones (r > g > b) and moderate variance\r\n'
    '        is_cardboard_toned = mean_r > mean_g > mean_b and mean_r > 80\r\n'
    '        has_low_variance = std_total < 55\r\n'
    '        # Very dark or very bright images suggest intact solid box\r\n'
    '        is_uniform = std_total < 30\r\n'
    '        if is_uniform or (is_cardboard_toned and has_low_variance):\r\n'
    '            return {\r\n'
    '                "damage_detected": False,\r\n'
    '                "labels": [\r\n'
    '                    {"label": "packaging appears intact", "confidence": 0.72, "location": "overall"}\r\n'
    '                ],\r\n'
    '                "severity": "none",\r\n'
    '                "damage_types": [],\r\n'
    '                "visible_text": [],\r\n'
    '                "summary": f"Image ({w}x{h}): packaging appears intact based on color uniformity analysis.",\r\n'
    '                "path": path,\r\n'
    '                "fallback": True,\r\n'
    '            }\r\n'
    '        return {\r\n'
    '            "damage_detected": True,\r\n'
    '            "labels": [\r\n'
    '                {"label": "potential damage visible", "confidence": 0.6, "location": "unknown"}\r\n'
    '            ],\r\n'
    '            "severity": "medium",\r\n'
    '            "damage_types": ["general_damage"],\r\n'
    '            "visible_text": [],\r\n'
    '            "summary": f"Damage image ({w}x{h}). High color variance detected. Manual inspection required.",\r\n'
    '            "path": path,\r\n'
    '            "fallback": True,\r\n'
    '        }'
)
if old_pil in content:
    content = content.replace(old_pil, new_pil, 1)
    changes.append('Enhanced PIL fallback with image heuristics for intact detection')
else:
    print('WARNING: PIL fallback block not found - checking alternate...')
    if '"damage_detected": True,' in content and '"severity": "medium"' in content:
        print('Alternate: damage_detected/medium found')

open('app/ai/gemini.py', 'wb').write(content.encode('utf-8'))
print('Patched gemini.py:', ', '.join(changes) if changes else 'No changes applied')
