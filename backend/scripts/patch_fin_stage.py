"""
Insert financial engine stage before Stage 9 in orchestrator.py
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

content = open('app/pipeline/orchestrator.py', 'rb').read().decode('utf-8')

# Find the line with Stage 9
idx = content.find('Stage 9: graph')
header_start = content.rfind('\r\n', 0, idx) + 2

fin_lines = [
    '        # Stage 8.5: financial calculation (dedicated engine)',
    '        from app.pipeline import financial as fin_mod',
    '        fin_data = fin_mod.compute_financials(parsed)',
    '        logger.info(',
    '            "Financial engine: billed=%d received=%d missing=%d damaged=%d loss=%.2f %s",',
    '            fin_data["billed_units"], fin_data["received_units"],',
    '            fin_data["missing_units"], fin_data["damaged_units"],',
    '            fin_data["estimated_loss"], fin_data["currency"],',
    '        )',
    '',
]
fin_block = '\r\n'.join(fin_lines) + '\r\n'

new_content = content[:header_start] + fin_block + content[header_start:]
open('app/pipeline/orchestrator.py', 'wb').write(new_content.encode('utf-8'))
print('SUCCESS: financial engine stage inserted before Stage 9')
