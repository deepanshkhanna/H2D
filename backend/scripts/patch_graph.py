"""Patch graph_builder.py to accept fin_data parameter and include financial data in risk node."""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

content = open('app/pipeline/graph_builder.py', 'rb').read().decode('utf-8')
changes = []

# Fix build_graph signature to accept fin_data
old_sig = (
    '    report_data: dict[str, Any] | None = None,\r\n'
    ') -> EvidenceGraph:'
)
new_sig = (
    '    report_data: dict[str, Any] | None = None,\r\n'
    '    fin_data: dict[str, Any] | None = None,\r\n'
    ') -> EvidenceGraph:'
)
if old_sig in content:
    content = content.replace(old_sig, new_sig, 1)
    changes.append('Added fin_data to build_graph signature')
else:
    print('WARNING: build_graph signature not found')

open('app/pipeline/graph_builder.py', 'wb').write(content.encode('utf-8'))
print('Patched graph_builder.py:', ', '.join(changes) if changes else 'No changes')
