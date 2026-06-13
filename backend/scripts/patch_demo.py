"""
Comprehensive patch for demo.tsx frontend fixes using CRLF-safe approach.
Reads file as bytes, normalizes line endings for matching, applies patches, writes back.

P4: Fix processing screen file count (only show uploaded files)  
P5: Enhanced risk widget with 4 tiers
P6: Edge hover tooltips  
P8: Contradiction edges in red dashed
P10: Audit Mode dev panel (Ctrl+Shift+D)
"""
import sys, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

raw = open('../frontend/src/routes/demo.tsx', 'rb').read()
# Normalize CRLF -> LF for matching, keep original for reconstruction
content = raw.decode('utf-8')
# We'll do all replacements on the \r\n version using re.sub with DOTALL

changes = []

def patch(name, old_snippet, new_snippet):
    """Replace old_snippet with new_snippet; old_snippet uses \n which we convert to \r\n"""
    old_crlf = old_snippet.replace('\n', '\r\n')
    new_crlf = new_snippet.replace('\n', '\r\n')
    global content, changes
    if old_crlf in content:
        content = content.replace(old_crlf, new_crlf, 1)
        changes.append(name)
    else:
        print(f'WARNING {name}: pattern not found')
        # Try a fuzzy match using first/last lines
        first_line = old_crlf.split('\r\n')[0].strip()
        if first_line:
            idx = content.find(first_line)
            if idx != -1:
                print(f'  Hint: first line found at char {idx}: {repr(content[max(0,idx-20):idx+80][:100])}')

# ===== P4: Fix processing screen - only show uploaded files =====
patch('P4-processing-screen',
'''              <div className="space-y-1.5">
                {(["invoice", "email", "image"] as const).map((role) => {
                  const f = files[role];
                  const hasFile = !!f;
                  const label =
                    role === "invoice" ? "Invoice" : role === "email" ? "Email" : "Photo";
                  const filename = f ? f.name : "demo_file_SHP-10488";
                  return (
                    <div
                      key={role}
                      className="rounded-md bg-surface/50 ring-1 ring-border/40 px-3 py-2.5 flex items-center gap-3"
                    >
                      <span className="size-2 rounded-full bg-warning animate-pulse" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] text-foreground font-medium truncate">
                          {filename}
                        </div>
                        <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-[0.14em] mt-0.5">
                          {label} · analyzing...
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>''',
'''              <div className="space-y-1.5">
                {(["invoice", "email", "image"] as const).map((role) => {
                  const f = files[role];
                  if (!f) return null;
                  const label =
                    role === "invoice" ? "Invoice" : role === "email" ? "Email" : "Photo";
                  const icons: Record<string, string> = { invoice: "📄", email: "📧", image: "🖼" };
                  return (
                    <div
                      key={role}
                      className="rounded-md bg-surface/50 ring-1 ring-primary/30 px-3 py-2.5 flex items-center gap-3"
                    >
                      <span className="size-2 rounded-full bg-primary animate-pulse" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] text-foreground font-medium truncate flex items-center gap-1.5">
                          <span>{icons[role]}</span>
                          <span>{f.name}</span>
                        </div>
                        <div className="font-mono text-[9px] text-primary uppercase tracking-[0.14em] mt-0.5">
                          {label} · analyzing...
                        </div>
                      </div>
                      <span className="font-mono text-[9px] text-muted-foreground/60 shrink-0">
                        {f.size < 1024 ? `${f.size} B` : f.size < 1048576 ? `${(f.size/1024).toFixed(1)} KB` : `${(f.size/1048576).toFixed(1)} MB`}
                      </span>
                    </div>
                  );
                })}
                {Object.values(files).every(f => !f) && (
                  <div className="rounded-md bg-surface/50 ring-1 ring-primary/30 px-3 py-2.5 flex items-center gap-3">
                    <span className="size-2 rounded-full bg-primary animate-pulse" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] text-foreground font-medium">Demo Case Files</div>
                      <div className="font-mono text-[9px] text-primary uppercase tracking-[0.14em] mt-0.5">
                        3 Files · analyzing...
                      </div>
                    </div>
                  </div>
                )}
              </div>'''
)

# ===== P5: Enhanced risk widget with 4 tiers and explanation =====
patch('P5-risk-tier-label',
'''                            <span
                              className={`mt-3 font-mono text-[10px] uppercase font-bold tracking-[0.16em] ring-1 px-3 py-1 rounded-full ${primaryConclusion.risk_label === "high" ? "bg-destructive/10 text-destructive ring-destructive/40" : "bg-warning/10 text-warning ring-warning/40"}`}
                            >
                              {primaryConclusion.risk_label.toUpperCase()} RISK LEVEL
                            </span>''',
'''                            {(() => {
                              const score = Math.round(primaryConclusion.risk_score);
                              const tier = score >= 76 ? "critical" : score >= 51 ? "high" : score >= 26 ? "moderate" : "low";
                              const tierConfig: Record<string, { label: string; cls: string; dot: string; desc: string }> = {
                                critical: { label: "CRITICAL", cls: "bg-red-900/20 text-red-400 ring-red-500/50", dot: "bg-red-400 animate-ping", desc: "Immediate escalation required" },
                                high: { label: "HIGH", cls: "bg-destructive/10 text-destructive ring-destructive/40", dot: "bg-destructive animate-pulse", desc: "Urgent investigation needed" },
                                moderate: { label: "MODERATE", cls: "bg-warning/10 text-warning ring-warning/40", dot: "bg-warning", desc: "Standard review process" },
                                low: { label: "LOW", cls: "bg-success/10 text-success ring-success/40", dot: "bg-success", desc: "Routine monitoring sufficient" },
                              };
                              const cfg = tierConfig[tier];
                              return (
                                <div className="flex flex-col items-center gap-2">
                                  <span className={`font-mono text-[10px] uppercase font-bold tracking-[0.16em] ring-1 px-3 py-1 rounded-full flex items-center gap-1.5 ${cfg.cls}`}>
                                    <span className={`size-1.5 rounded-full ${cfg.dot}`} />
                                    {cfg.label} RISK
                                  </span>
                                  <p className="text-[9px] font-mono text-muted-foreground text-center max-w-[160px] leading-relaxed">
                                    {cfg.desc}
                                  </p>
                                </div>
                              );
                            })()}'''
)

# ===== P5: Risk gauge color 4 tiers =====
patch('P5-risk-gauge-color',
'''                                   stroke={
                                     primaryConclusion.risk_label === "high"
                                       ? "oklch(0.55 0.2 18)"
                                       : "oklch(0.74 0.15 65)"
                                   }''',
'''                                   stroke={(() => {
                                     const s = Math.round(primaryConclusion.risk_score);
                                     return s >= 76 ? "oklch(0.50 0.25 18)" :
                                            s >= 51 ? "oklch(0.55 0.2 18)" :
                                            s >= 26 ? "oklch(0.74 0.15 65)" :
                                            "oklch(0.68 0.16 140)";
                                   })()}'''
)

# ===== P8: Contradiction edges in red dashed + P6: hover tooltip =====
patch('P8-P6-edge-render',
'''          {/* Edge lines with blue pulse animation */}
          {edges.map((e) => {
            const sp = positions[e.source];
            const tp = positions[e.target];
            if (!sp || !tp) return null;
            const isActive = activeEdges.has(e.id);
            const isConfirmed = e.status === "confirmed";
            const isProbable = e.status === "probable";

            return (
              <g key={e.id}>
                {/* Base edge line */}
                <line
                  x1={sp.x}
                  y1={sp.y}
                  x2={tp.x}
                  y2={tp.y}
                  stroke={
                    isActive
                      ? "oklch(0.62 0.18 258)"
                      : isConfirmed
                        ? "oklch(0.45 0.12 258)"
                        : "oklch(0.27 0.012 270)"
                  }
                  strokeWidth={isActive ? 0.8 : isConfirmed ? 0.45 : 0.25}
                  strokeOpacity={isActive ? 1.0 : isConfirmed ? 0.7 : 0.35}
                  strokeDasharray={isProbable ? "2 1.5" : undefined}
                  className={`transition-all duration-300 ${isConfirmed && !isActive ? "edge-glow" : ""}`}
                />
                {/* Blue glow overlay for confirmed edges */}
                {isConfirmed && (
                  <line
                    x1={sp.x}
                    y1={sp.y}
                    x2={tp.x}
                    y2={tp.y}
                    stroke="oklch(0.62 0.18 258)"
                    strokeWidth="1.2"
                    strokeOpacity={0.12}
                    className="edge-glow"
                  />
                )}
                {/* Flow animation on active edges */}
                {isActive && (
                  <line
                    x1={sp.x}
                    y1={sp.y}
                    x2={tp.x}
                    y2={tp.y}
                    stroke="oklch(0.62 0.18 258)"
                    strokeWidth="0.5"
                    strokeOpacity="0.6"
                    className="edge-flow"
                  />
                )}
              </g>
            );
          })}''',
'''          {/* Edge lines — confirmed=blue glow, probable=dashed, contradicts=red dashed */}
          {edges.map((e) => {
            const sp = positions[e.source];
            const tp = positions[e.target];
            if (!sp || !tp) return null;
            const isActive = activeEdges.has(e.id);
            const isConfirmed = e.status === "confirmed";
            const isProbable = e.status === "probable";
            const isContradicts = e.type === "contradicts";
            const mx = (sp.x + tp.x) / 2;
            const my = (sp.y + tp.y) / 2;

            return (
              <g key={e.id}>
                {/* Base edge */}
                <line
                  x1={sp.x} y1={sp.y} x2={tp.x} y2={tp.y}
                  stroke={
                    isContradicts ? "oklch(0.55 0.22 18)" :
                    isActive ? "oklch(0.62 0.18 258)" :
                    isConfirmed ? "oklch(0.45 0.12 258)" :
                    "oklch(0.27 0.012 270)"
                  }
                  strokeWidth={isActive ? 0.9 : isContradicts ? 0.7 : isConfirmed ? 0.45 : 0.2}
                  strokeOpacity={isActive ? 1.0 : isContradicts ? 0.85 : isConfirmed ? 0.7 : 0.2}
                  strokeDasharray={isContradicts ? "1.5 1.2" : isProbable ? "2 1.5" : undefined}
                  className={`transition-all duration-300 ${isConfirmed && !isActive && !isContradicts ? "edge-glow" : ""}`}
                />
                {/* CONTRADICTS label */}
                {isContradicts && (
                  <text x={mx} y={my - 1.5} textAnchor="middle" fontSize="2.2"
                    fill="oklch(0.65 0.22 18)" fillOpacity={isActive ? 1 : 0.75}
                    className="pointer-events-none font-mono font-bold uppercase tracking-wide"
                  >CONTRADICTS</text>
                )}
                {/* Blue glow for confirmed */}
                {isConfirmed && !isContradicts && (
                  <line x1={sp.x} y1={sp.y} x2={tp.x} y2={tp.y}
                    stroke="oklch(0.62 0.18 258)" strokeWidth="1.2" strokeOpacity={0.12}
                    className="edge-glow"
                  />
                )}
                {/* Flow pulse on active */}
                {isActive && !isContradicts && (
                  <line x1={sp.x} y1={sp.y} x2={tp.x} y2={tp.y}
                    stroke="oklch(0.62 0.18 258)" strokeWidth="0.5" strokeOpacity="0.6"
                    className="edge-flow"
                  />
                )}
                {/* Hover tooltip: relation type + confidence */}
                {isActive && (
                  <g>
                    <rect x={mx - 12} y={my - 4.5} width={24} height={6} rx={1.5}
                      fill="oklch(0.12 0.01 270)" fillOpacity={0.92}
                      stroke={isContradicts ? "oklch(0.55 0.22 18)" : "oklch(0.62 0.18 258)"}
                      strokeWidth={0.3}
                    />
                    <text x={mx} y={my - 0.5} textAnchor="middle" fontSize="2.4"
                      fill={isContradicts ? "oklch(0.75 0.2 18)" : "oklch(0.62 0.18 258)"}
                      className="pointer-events-none font-mono font-bold"
                    >
                      {(e.type ?? "link").replace(/_/g, " ")} · {Math.round((e.confidence ?? 0) * 100)}%
                    </text>
                  </g>
                )}
              </g>
            );
          })}'''
)

# ===== P8: Add CONTRADICTS legend entry =====
patch('P8-legend',
'''          <div className="flex items-center gap-2">
            <span className="w-5 h-px border-t border-dashed border-white/30" />
            <span className="font-mono text-[9px] text-white/40 uppercase tracking-wider">
              probable
            </span>
          </div>
        </div>''',
'''          <div className="flex items-center gap-2">
            <span className="w-5 h-px border-t border-dashed border-white/30" />
            <span className="font-mono text-[9px] text-white/40 uppercase tracking-wider">
              probable
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-px border-t-2 border-dashed border-red-500/70" style={{borderStyle:"dashed"}} />
            <span className="font-mono text-[9px] text-red-400/70 uppercase tracking-wider">
              contradicts
            </span>
          </div>
        </div>'''
)

# ===== P10: Audit Mode state =====
patch('P10-audit-state',
'''  const termRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelRef = useRef(false);''',
'''  const [auditPanelOpen, setAuditPanelOpen] = useState(false);

  const termRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelRef = useRef(false);

  // P10: Audit Mode toggle (Ctrl+Shift+D)
  useEffect(() => {
    function handleAuditKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        setAuditPanelOpen(p => !p);
      }
    }
    window.addEventListener("keydown", handleAuditKey);
    return () => window.removeEventListener("keydown", handleAuditKey);
  }, []);'''
)

# ===== P10: Audit panel render =====
patch('P10-audit-panel',
'''      {/* Node details drawer */}
      {selectedNodeId && selectedNode && (''',
'''      {/* P10: Audit Mode Dev Panel (Ctrl+Shift+D) */}
      {auditPanelOpen && graph && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end justify-center p-4"
          onClick={() => setAuditPanelOpen(false)}
        >
          <div
            className="w-full max-w-6xl max-h-[85vh] overflow-y-auto rounded-xl bg-[oklch(0.07_0.008_270)] border border-primary/30 shadow-2xl font-mono text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/30">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary animate-pulse" />
                <span className="text-primary uppercase tracking-wider font-bold">
                  Audit Mode · Debug Panel
                </span>
                <span className="text-muted-foreground text-[9px] ml-2">Ctrl+Shift+D to close</span>
              </div>
              <button onClick={() => setAuditPanelOpen(false)} className="text-muted-foreground hover:text-foreground px-2">×</button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 p-5">
              <div>
                <div className="text-primary uppercase tracking-wider mb-2 text-[10px] font-bold">
                  Graph Nodes ({graph.nodes.length})
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {graph.nodes.map((n) => (
                    <div key={n.id} className="rounded bg-white/5 px-2 py-1">
                      <span className="text-foreground/80">{n.type}</span>
                      <span className="text-muted-foreground mx-1">·</span>
                      <span className="text-primary">{n.label.slice(0, 30)}</span>
                      <span className="text-muted-foreground ml-1">({Math.round(n.confidence * 100)}%)</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-primary uppercase tracking-wider mb-2 text-[10px] font-bold">
                  Graph Edges ({graph.edges.length})
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {graph.edges.map((e) => (
                    <div
                      key={e.id}
                      className={`rounded px-2 py-1 ${e.type === "contradicts" ? "bg-red-900/20 text-red-400" : "bg-white/5"}`}
                    >
                      <span className="text-foreground/70">{e.type}</span>
                      <span className="text-muted-foreground mx-1">·</span>
                      <span className="text-[9px]">{e.status}</span>
                      <span className="text-primary ml-1">{Math.round((e.confidence ?? 0) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-primary uppercase tracking-wider mb-2 text-[10px] font-bold">
                  Pipeline Events
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {Object.entries(pipelineEvents).map(([stage, ev]) => (
                    <div key={stage} className="rounded bg-white/5 px-2 py-1">
                      <div className="text-success text-[9px]">✓ {stage.replace(/_/g, " ")}</div>
                      {ev.duration && (
                        <div className="text-muted-foreground text-[9px]">
                          {ev.duration >= 1000 ? `${(ev.duration / 1000).toFixed(2)}s` : `${Math.round(ev.duration)}ms`}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-primary uppercase tracking-wider mb-2 text-[10px] font-bold">
                  Hypotheses
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {(graph.explanations[0] as any)?.root_cause_hypotheses?.map((h: any, i: number) => (
                    <div key={i} className="rounded bg-white/5 px-2 py-1">
                      <div className="text-foreground/80">{h.hypothesis?.slice(0, 40)}</div>
                      <div className="text-primary">{Math.round(h.confidence * 100)}% confidence</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-primary uppercase tracking-wider mb-2 text-[10px] font-bold">
                  Financial Engine
                </div>
                <div className="rounded bg-white/5 px-3 py-2 space-y-1">
                  {(graph.explanations[0] as any)?.financial_impact && (
                    <>
                      <div>
                        <span className="text-muted-foreground">Loss: </span>
                        <span className="text-primary font-bold">
                          {(graph.explanations[0] as any).financial_impact.currency}{" "}
                          {(graph.explanations[0] as any).financial_impact.estimated_loss?.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-muted-foreground text-[9px] mt-1">
                        {(graph.explanations[0] as any).financial_impact.breakdown}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div>
                <div className="text-primary uppercase tracking-wider mb-2 text-[10px] font-bold">
                  Risk Score
                </div>
                <div className="rounded bg-white/5 px-3 py-2">
                  <div className="text-2xl font-bold text-foreground">
                    {Math.round(graph.explanations[0]?.risk_score ?? 0)}
                    <span className="text-muted-foreground text-sm">/100</span>
                  </div>
                  <div className="text-primary uppercase tracking-wider text-[9px] mt-1">
                    {graph.explanations[0]?.risk_label} RISK
                  </div>
                  <div className="mt-2 text-muted-foreground text-[9px]">
                    {graph.explanations[0]?.recommended_action?.slice(0, 80)}
                  </div>
                </div>
              </div>
            </div>
            <div className="px-5 py-2 border-t border-border/30 text-muted-foreground text-[9px]">
              Incident: {graph.metadata.incident_id} · Created: {graph.metadata.created_at} · Hash:{" "}
              {graph.metadata.input_hash}
            </div>
          </div>
        </div>
      )}

      {/* Node details drawer */}
      {selectedNodeId && selectedNode && ('''
)

open('../frontend/src/routes/demo.tsx', 'wb').write(content.encode('utf-8'))
print('Patched demo.tsx:', ', '.join(changes) if changes else 'No changes applied')
print(f'Total changes: {len(changes)}')
