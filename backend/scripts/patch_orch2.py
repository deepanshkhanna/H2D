"""
Patch script for orchestrator.py - adds financial engine integration.
Run from backend/ directory: venv\Scripts\python scripts\patch_orch2.py
"""
import os

path = os.path.join('app', 'pipeline', 'orchestrator.py')
content = open(path, 'rb').read().decode('utf-8')

changes = []

# 1) Insert financial engine before Stage 9
old_s9 = '        # \u2500\u2500 Stage 9: graph construction \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500'
if old_s9 in content:
    fin_insert = (
        '        # \u2500\u2500 Stage 8.5: financial calculation (dedicated engine) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r\n'
        '        from app.pipeline import financial as fin_mod\r\n'
        '        fin_data = fin_mod.compute_financials(parsed)\r\n'
        '        logger.info(\r\n'
        '            "Financial: billed=%d received=%d missing=%d damaged=%d loss=%.2f %s",\r\n'
        '            fin_data["billed_units"], fin_data["received_units"],\r\n'
        '            fin_data["missing_units"], fin_data["damaged_units"],\r\n'
        '            fin_data["estimated_loss"], fin_data["currency"],\r\n'
        '        )\r\n'
        '\r\n'
        '        ' + old_s9.strip()
    )
    content = content.replace(old_s9, fin_insert, 1)
    changes.append('Inserted financial engine stage')
else:
    print('WARNING: Stage 9 header not found exactly')

# 2) Add fin_data to generate_investigation_report call
old_call = '            risk_data=risk_data\r\n        )'
new_call = '            risk_data=risk_data,\r\n            fin_data=fin_data,\r\n        )'
if old_call in content:
    content = content.replace(old_call, new_call, 1)
    changes.append('Added fin_data to generate_investigation_report')
else:
    print('WARNING: generate_investigation_report call signature not found')

# 3) Add fin_data to graph_builder call
old_gb = '            list(stored_files.values()), report_data\r\n        )'
new_gb = '            list(stored_files.values()), report_data, fin_data\r\n        )'
if old_gb in content:
    content = content.replace(old_gb, new_gb, 1)
    changes.append('Added fin_data to graph_builder.build_graph')
else:
    print('WARNING: graph_builder call not found')

# 4) Add financial summary to evidence prompt (before evidence_summary_prompt join)
old_prompt = '        evidence_summary_prompt = "\\n".join(evidence_summary_parts)'
new_prompt = (
    '        evidence_summary_parts.append(\r\n'
    '            f"FINANCIAL ENGINE: billed={fin_data[\'billed_units\']} "\r\n'
    '            f"received={fin_data[\'received_units\']} "\r\n'
    '            f"missing={fin_data[\'missing_units\']} damaged={fin_data[\'damaged_units\']} "\r\n'
    '            f"unit_price={fin_data[\'unit_price\']} "\r\n'
    '            f"estimated_loss={fin_data[\'currency\']} {fin_data[\'estimated_loss\']:.2f}"\r\n'
    '        )\r\n'
    '\r\n'
    '        evidence_summary_prompt = "\\n".join(evidence_summary_parts)'
)
if old_prompt in content:
    content = content.replace(old_prompt, new_prompt, 1)
    changes.append('Added financial summary to evidence prompt')
else:
    print('WARNING: evidence_summary_prompt join not found')

open(path, 'wb').write(content.encode('utf-8'))
print('Patched orchestrator.py:', ', '.join(changes) if changes else 'No changes made')
