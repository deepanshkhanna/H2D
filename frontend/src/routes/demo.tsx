import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mono, StatusPill, MoneyExposure, ConfidenceLabel, EvidenceChip, SectionLabel,
} from "@/components/forensic/primitives";
import { strengthForConfidence, shortHash } from "@/lib/strength";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Demo Case — OpsPilot AI" },
      { name: "description", content: "Live walkthrough of OpsPilot AI evidence correlation on case SHP-10488." },
    ],
  }),
  component: DemoPage,
});

// ─── Fake data ────────────────────────────────────────────────────────────────

const DEMO_CASE = {
  id: "demo-001",
  title: "Shipment SHP-10488 — shortage dispute",
  reference: "CASE-4402",
  status: "review_needed",
  severity: "high",
  financial_exposure_cents: 6360000,
  created_at: "2026-05-28T09:14:00Z",
};

const DEMO_EVIDENCE = [
  {
    id: "ev-001",
    case_id: "demo-001",
    kind: "invoice",
    filename: "invoice_SHP-10488.txt",
    mime_type: "text/plain",
    status: "extracted",
    summary: "Invoice for 42 units of SKU-884-X @ $1,500 each. Total: $63,000. Shipped via NorthRail XJ-9 on 2026-05-26. PO-9204. Origin: Chicago IL, Destination: Mumbai IN.",
    uploaded_at: "2026-05-28T09:14:22Z",
  },
  {
    id: "ev-002",
    case_id: "demo-001",
    kind: "email",
    filename: "complaint_email_SHP-10488.eml",
    mime_type: "message/rfc822",
    status: "extracted",
    summary: "Buyer complaint: only 29 units received against PO of 42. Claims 13 units missing. References BL-44821. Requests urgent investigation and credit note. Sent by buyer@acme.co to ops@vendor.co.",
    uploaded_at: "2026-05-28T09:17:05Z",
  },
  {
    id: "ev-003",
    case_id: "demo-001",
    kind: "photo",
    filename: "dock_cam_03_2026-05-26.jpg",
    mime_type: "image/jpeg",
    status: "extracted",
    summary: "Dock camera image shows 3 pallets unloaded at 02:14 UTC. Visible damage on corner pallet. Forklift operator present. Bay 7, NorthRail XJ-9 docking slot.",
    uploaded_at: "2026-05-28T09:20:44Z",
  },
];

const DEMO_CONCLUSIONS = [
  {
    id: "con-001",
    title: "13-unit shortage confirmed across invoice and complaint",
    severity: "high",
    root_cause: "Invoice records 42 units dispatched (PO-9204). Buyer receipt confirms only 29 delivered — a discrepancy of exactly 13 units valued at $19,500. The dock photo corroborates a reduced pallet count at destination.",
    reasoning: "Three independent evidence sources — the invoice, the complaint email, and the dock camera image — all converge on the same 13-unit figure. The invoice hash chain verifies no post-dispatch alteration. BL-44821 manifest cross-reference has not yet been obtained, which is the main uncertainty flagging this for human review.",
    confidence: 94,
    strength_label: "strong",
    financial_exposure_cents: 6360000,
    recommended_action: "Issue credit note for $19,500 immediately; request BL-44821 from NorthRail within 24 h",
    needs_human_review: true,
    is_primary: true,
    model_name: "gemini-1.5-flash",
    model_run_at: "2026-05-28T09:25:11Z",
    input_hash: "a3f8c2e19b4d7f60a3f8c2e19b4d7f60",
  },
  {
    id: "con-002",
    title: "Potential damage to corner pallet — insurance trigger",
    severity: "medium",
    root_cause: "Dock photo shows visible damage on one corner pallet consistent with forklift impact. Combined with a shortage claim, this may constitute a carrier liability event under transit insurance clause 14-B.",
    reasoning: "Image analysis identified structural deformation on the outermost pallet at bay 7. The NorthRail XJ-9 docking record time-aligns with the complaint email timeline within a 2-hour window, supporting the damage-in-transit hypothesis.",
    confidence: 78,
    strength_label: "likely",
    financial_exposure_cents: 2400000,
    recommended_action: "File NorthRail damage claim within 48 h; preserve dock camera footage",
    needs_human_review: false,
    is_primary: false,
    model_name: "gemini-1.5-flash",
    model_run_at: "2026-05-28T09:25:11Z",
    input_hash: "a3f8c2e19b4d7f60a3f8c2e19b4d7f60",
  },
];

const DEMO_LINKS = [
  { conclusion_id: "con-001", evidence_id: "ev-001" },
  { conclusion_id: "con-001", evidence_id: "ev-002" },
  { conclusion_id: "con-001", evidence_id: "ev-003" },
  { conclusion_id: "con-002", evidence_id: "ev-002" },
  { conclusion_id: "con-002", evidence_id: "ev-003" },
];

const DEMO_EVENTS = [
  { id: "evt-001", kind: "evidence_uploaded", title: "invoice · invoice_SHP-10488.txt", occurred_at: "2026-05-28T09:14:22Z" },
  { id: "evt-002", kind: "entity_extracted", title: "Extracted 9 entities from invoice_SHP-10488.txt", occurred_at: "2026-05-28T09:14:55Z" },
  { id: "evt-003", kind: "evidence_uploaded", title: "email · complaint_email_SHP-10488.eml", occurred_at: "2026-05-28T09:17:05Z" },
  { id: "evt-004", kind: "entity_extracted", title: "Extracted 7 entities from complaint_email_SHP-10488.eml", occurred_at: "2026-05-28T09:17:31Z" },
  { id: "evt-005", kind: "evidence_uploaded", title: "photo · dock_cam_03_2026-05-26.jpg", occurred_at: "2026-05-28T09:20:44Z" },
  { id: "evt-006", kind: "entity_extracted", title: "Extracted 5 entities from dock_cam_03_2026-05-26.jpg", occurred_at: "2026-05-28T09:21:02Z" },
  { id: "evt-007", kind: "correlation_found", title: "Correlation complete · 2 conclusion(s)", occurred_at: "2026-05-28T09:25:11Z" },
  { id: "evt-008", kind: "conclusion_generated", title: "13-unit shortage confirmed across invoice and complaint", occurred_at: "2026-05-28T09:25:11Z" },
  { id: "evt-009", kind: "conclusion_generated", title: "Potential damage to corner pallet — insurance trigger", occurred_at: "2026-05-28T09:25:12Z" },
  { id: "evt-010", kind: "status_changed", title: "Status → review_needed", occurred_at: "2026-05-28T09:25:13Z" },
];

const DEMO_ENTITIES = [
  { type: "shipment_id", value: "SHP-10488", confidence: 99, source: "invoice" },
  { type: "po_number", value: "PO-9204", confidence: 98, source: "invoice" },
  { type: "quantity", value: "42 units dispatched", confidence: 97, source: "invoice" },
  { type: "sku", value: "SKU-884-X", confidence: 96, source: "invoice" },
  { type: "amount_usd", value: "$63,000", confidence: 99, source: "invoice" },
  { type: "carrier", value: "NorthRail XJ-9", confidence: 97, source: "invoice" },
  { type: "quantity", value: "29 units received", confidence: 99, source: "email" },
  { type: "shipment_id", value: "SHP-10488", confidence: 98, source: "email" },
  { type: "anomaly", value: "13 units missing", confidence: 99, source: "email" },
  { type: "person_email", value: "buyer@acme.co", confidence: 99, source: "email" },
  { type: "date_iso", value: "2026-05-26", confidence: 95, source: "photo" },
  { type: "anomaly", value: "visible pallet damage", confidence: 88, source: "photo" },
  { type: "location", value: "Bay 7, NorthRail dock", confidence: 82, source: "photo" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

function DemoPage() {
  const [tab, setTab] = useState<"case" | "entities">("case");

  const primary = DEMO_CONCLUSIONS[0];
  const others = DEMO_CONCLUSIONS.slice(1);
  const evById = new Map(DEMO_EVIDENCE.map((e) => [e.id, e]));
  const linksByConclusion = new Map<string, string[]>();
  for (const l of DEMO_LINKS) {
    const arr = linksByConclusion.get(l.conclusion_id) ?? [];
    arr.push(l.evidence_id);
    linksByConclusion.set(l.conclusion_id, arr);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary shadow-[0_0_12px_oklch(0.62_0.18_258_/_0.6)]" />
            <span className="font-medium tracking-tight">OpsPilot</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground ml-1">Demo</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary ring-1 ring-primary/30 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em]">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              Live Demo
            </div>
            <Link to="/login" className="text-muted-foreground hover:text-foreground transition-colors">Open Console →</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Case Header */}
        <div className="flex items-center gap-3 mb-6">
          <StatusPill status={DEMO_CASE.status} />
          <span className="font-mono text-[11px] text-muted-foreground">{DEMO_CASE.reference}</span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-warning/10 text-warning ring-1 ring-warning/30 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em]">
            <span className="size-1.5 rounded-full bg-warning animate-pulse" />
            1 conclusion needs review
          </span>
        </div>
        <h1 className="text-2xl md:text-3xl font-medium tracking-tight mb-8">{DEMO_CASE.title}</h1>

        {/* Tab switcher */}
        <div className="flex gap-1 mb-8 rounded-lg bg-surface ring-1 ring-border/50 p-1 w-fit">
          {(["case", "entities"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t === "case" ? "Case Summary" : "Extracted Entities"}
            </button>
          ))}
        </div>

        {tab === "case" ? (
          <CaseView primary={primary} others={others} evById={evById} linksByConclusion={linksByConclusion} />
        ) : (
          <EntitiesView />
        )}
      </main>
    </div>
  );
}

// ─── Case View ────────────────────────────────────────────────────────────────

function CaseView({ primary, others, evById, linksByConclusion }: any) {
  return (
    <>
      {/* Primary Conclusion */}
      <PrimaryConclusion
        conclusion={primary}
        evIds={linksByConclusion.get(primary.id) ?? []}
        evById={evById}
        caseRef={DEMO_CASE.reference}
      />

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        {/* Left: Evidence sources */}
        <aside className="space-y-4">
          <SectionLabel>Evidence Sources</SectionLabel>
          <div className="space-y-1.5">
            {DEMO_EVIDENCE.map((e) => <EvidenceRow key={e.id} ev={e} />)}
          </div>
        </aside>

        {/* Right: Other conclusions + graph + playback + audit */}
        <div className="space-y-10 min-w-0">
          {others.length > 0 && (
            <section>
              <SectionLabel>Other Case Conclusions</SectionLabel>
              <div className="space-y-3">
                {others.map((c: any) => (
                  <ConclusionCard key={c.id} conclusion={c} evIds={linksByConclusion.get(c.id) ?? []} evById={evById} />
                ))}
              </div>
            </section>
          )}

          <section>
            <SectionLabel>Evidence Graph</SectionLabel>
            <DemoEvidenceGraph />
          </section>

          <section>
            <SectionLabel>Investigation Playback</SectionLabel>
            <Playback events={DEMO_EVENTS} />
          </section>

          <section>
            <SectionLabel>Audit Trail</SectionLabel>
            <ol className="rounded-lg bg-surface ring-1 ring-border/40 divide-y divide-border/40">
              {DEMO_EVENTS.map((ev) => (
                <li key={ev.id} className="px-4 py-2.5 flex items-baseline gap-4 text-[12px]">
                  <span className="font-mono text-[10px] text-muted-foreground w-36 shrink-0">
                    {new Date(ev.occurred_at).toLocaleString()}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary w-36 shrink-0">
                    {ev.kind.replace(/_/g, " ")}
                  </span>
                  <span className="text-foreground/85">{ev.title}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}

// ─── Entities View ────────────────────────────────────────────────────────────

function EntitiesView() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-surface ring-1 ring-border/40 overflow-hidden">
        <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between">
          <Mono>Extracted Entities · {DEMO_ENTITIES.length} total</Mono>
          <span className="font-mono text-[10px] text-muted-foreground">3 evidence sources</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 bg-background/40">
              <th className="text-left px-5 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Type</th>
              <th className="text-left px-5 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Value</th>
              <th className="text-left px-5 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Source</th>
              <th className="text-right px-5 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Conf.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {DEMO_ENTITIES.map((e, i) => (
              <tr key={i} className="hover:bg-surface-2 transition-colors">
                <td className="px-5 py-2.5 font-mono text-[11px] text-primary uppercase tracking-[0.1em]">{e.type.replace(/_/g, " ")}</td>
                <td className="px-5 py-2.5 text-[13px] text-foreground font-medium">{e.value}</td>
                <td className="px-5 py-2.5">
                  <EvidenceChip label={e.source} tone={e.source === "invoice" ? "primary" : e.source === "email" ? "warning" : "neutral"} />
                </td>
                <td className="px-5 py-2.5 text-right">
                  <span className={`font-mono text-[12px] font-semibold ${e.confidence >= 90 ? "text-success" : e.confidence >= 75 ? "text-primary" : "text-warning"}`}>
                    {e.confidence}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg bg-surface ring-1 ring-border/40 p-5">
        <Mono className="mb-3">Evidence Summaries</Mono>
        <div className="space-y-3">
          {DEMO_EVIDENCE.map((e) => (
            <div key={e.id} className="rounded-md bg-surface-2 ring-1 ring-border/40 p-4">
              <div className="flex items-center gap-3 mb-2">
                <EvidenceChip label={e.kind} tone="neutral" />
                <span className="font-mono text-[11px] text-muted-foreground">{e.filename}</span>
              </div>
              <p className="text-[13px] text-foreground/80 leading-relaxed">{e.summary}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function PrimaryConclusion({ conclusion: c, evIds, evById, caseRef }: any) {
  const strength = strengthForConfidence(Number(c.confidence));
  return (
    <div className="rounded-xl bg-surface ring-1 ring-primary/30 shadow-[0_0_60px_-20px_oklch(0.62_0.18_258_/_0.45)] overflow-hidden">
      <div className="px-6 pt-6 pb-2 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em]">
            <span className="size-1.5 rounded-full bg-destructive" />
            High Risk Incident
          </div>
          <h2 className="mt-3 text-2xl font-medium tracking-tight text-foreground">{c.title}</h2>
        </div>
        <ConfidenceLabel confidence={Number(c.confidence)} label={strength} />
      </div>
      <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8">
        <div className="space-y-5 min-w-0">
          <div>
            <Mono>Root Cause</Mono>
            <p className="mt-2 text-sm text-foreground/90 leading-relaxed">{c.root_cause}</p>
          </div>
          <div>
            <Mono>Reasoning</Mono>
            <p className="mt-2 text-sm text-foreground/80 leading-relaxed">{c.reasoning}</p>
          </div>
          {evIds.length > 0 && (
            <div>
              <Mono>Evidence Chain</Mono>
              <div className="mt-2 flex flex-wrap gap-2">
                {evIds.map((id: string) => {
                  const e = evById.get(id);
                  return e ? <EvidenceChip key={id} label={`${e.kind} · ${e.filename}`} tone="primary" /> : null;
                })}
              </div>
            </div>
          )}
        </div>
        <div className="md:w-56 flex flex-col gap-5 md:border-l md:border-border/40 md:pl-6">
          <MoneyExposure cents={Number(c.financial_exposure_cents)} size="lg" />
          {c.recommended_action && (
            <div>
              <Mono>Recommended Action</Mono>
              <div className="mt-2 w-full rounded-md bg-foreground text-background text-xs font-semibold py-2.5 px-3 leading-snug">
                {c.recommended_action}
              </div>
            </div>
          )}
        </div>
      </div>
      <ProvenanceFooter c={c} caseRef={caseRef} />
    </div>
  );
}

function ConclusionCard({ conclusion: c, evIds, evById }: any) {
  const strength = strengthForConfidence(Number(c.confidence));
  return (
    <div className="rounded-lg bg-surface ring-1 ring-border/50 overflow-hidden">
      <div className="px-5 py-4 flex items-start justify-between gap-4 border-b border-border/40 flex-wrap">
        <div className="min-w-0">
          <div className="text-[15px] font-medium text-foreground">{c.title}</div>
        </div>
        <ConfidenceLabel confidence={Number(c.confidence)} label={strength} compact />
      </div>
      <div className="px-5 py-4 space-y-3 text-sm">
        <p className="text-foreground/80 leading-relaxed">{c.root_cause}</p>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <MoneyExposure cents={Number(c.financial_exposure_cents)} label="Exposure" size="sm" />
          <div className="flex flex-wrap gap-1.5">
            {evIds.slice(0, 3).map((id: string) => {
              const e = evById.get(id);
              return e ? <EvidenceChip key={id} label={e.kind} /> : null;
            })}
          </div>
        </div>
      </div>
      <ProvenanceFooter c={c} />
    </div>
  );
}

function ProvenanceFooter({ c, caseRef }: { c: any; caseRef?: string }) {
  return (
    <div className="px-5 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground bg-background/40 border-t border-border/40">
      <span>Generated using <span className="text-foreground/80">{c.model_name.split("/").pop()}</span></span>
      <span>{new Date(c.model_run_at).toISOString().slice(11, 19)} UTC</span>
      <span>Hash {shortHash(c.input_hash)}</span>
      {caseRef && <span className="ml-auto">{caseRef}</span>}
    </div>
  );
}

function EvidenceRow({ ev }: { ev: any }) {
  const tone = ev.status === "extracted" ? "bg-primary"
    : ev.status === "extracting" ? "bg-warning animate-pulse"
    : ev.status === "failed" ? "bg-destructive" : "bg-muted-foreground";
  return (
    <div className="rounded-md bg-surface ring-1 ring-border/50 px-3 py-2 flex items-center gap-3">
      <span className={`size-1.5 rounded-full ${tone}`} />
      <div className="min-w-0 flex-1">
        <div className="text-[12px] text-foreground truncate">{ev.filename}</div>
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.14em]">{ev.kind} · {ev.status}</div>
      </div>
    </div>
  );
}

function DemoEvidenceGraph() {
  const evPositions = [
    { id: "ev-001", x: 20, y: 25, kind: "invoice", linked: true },
    { id: "ev-002", x: 18, y: 70, kind: "email", linked: true },
    { id: "ev-003", x: 75, y: 20, kind: "photo", linked: true },
  ];
  const cx = 50, cy = 50;
  return (
    <div className="rounded-lg bg-surface ring-1 ring-border/40 dot-grid p-6 aspect-[2/1] relative overflow-hidden">
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="edge-gradient" x1="0" x2="1">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="oklch(0.62 0.18 258)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        {/* Secondary conclusion node */}
        <circle cx={78} cy={72} r={2.5} fill="oklch(0.45 0.10 258)" />
        <line x1={78} y1={72} x2={18} y2={70} stroke="oklch(0.27 0.012 270)" strokeOpacity={0.35} strokeWidth={0.2} />
        <line x1={78} y1={72} x2={75} y2={20} stroke="oklch(0.27 0.012 270)" strokeOpacity={0.35} strokeWidth={0.2} />

        {evPositions.map((e) => (
          <line key={e.id} x1={cx} y1={cy} x2={e.x} y2={e.y}
            stroke={e.linked ? "oklch(0.62 0.18 258)" : "oklch(0.27 0.012 270)"}
            strokeOpacity={e.linked ? 0.5 : 0.35}
            strokeWidth={e.linked ? 0.35 : 0.2}
          />
        ))}
        {/* Primary conclusion center */}
        <circle cx={cx} cy={cy} r={3.5} fill="oklch(0.62 0.18 258)" />
        <circle cx={cx} cy={cy} r={5.5} fill="oklch(0.62 0.18 258)" fillOpacity={0.15} />

        {evPositions.map((e) => (
          <g key={e.id}>
            <circle cx={e.x} cy={e.y} r={2.2} fill="oklch(0.97 0.005 270)" />
          </g>
        ))}
      </svg>

      {/* Labels */}
      <div className="absolute" style={{ left: "7%", top: "18%" }}>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">invoice</span>
      </div>
      <div className="absolute" style={{ left: "5%", top: "64%" }}>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">email</span>
      </div>
      <div className="absolute" style={{ left: "68%", top: "13%" }}>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">photo</span>
      </div>
      <div className="absolute" style={{ left: "44%", top: "44%" }}>
        <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-primary opacity-80">primary</span>
      </div>

      <div className="absolute bottom-3 left-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        3 evidence · 2 conclusion(s)
      </div>
    </div>
  );
}

function Playback({ events }: { events: typeof DEMO_EVENTS }) {
  const [step, setStep] = useState(events.length - 1);
  const [playing, setPlaying] = useState(false);

  const play = async () => {
    setPlaying(true);
    setStep(0);
    for (let i = 1; i < events.length; i++) {
      await new Promise((r) => setTimeout(r, 700));
      setStep(i);
    }
    setPlaying(false);
  };

  return (
    <div className="rounded-lg bg-surface ring-1 ring-border/40 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Step {step + 1} of {events.length}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setStep(0)}
            disabled={playing}
            className="rounded bg-surface-2 ring-1 ring-border/60 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.14em] hover:bg-surface transition-colors disabled:opacity-40"
          >Reset</button>
          <button
            onClick={play}
            disabled={playing}
            className="rounded bg-primary text-primary-foreground ring-1 ring-primary/70 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.14em] hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            {playing ? "Playing…" : "Play ▸"}
          </button>
        </div>
      </div>
      <ol className="relative pl-6">
        <div className="absolute left-2 top-0 bottom-0 w-px bg-border/40" />
        <AnimatePresence>
          {events.slice(0, step + 1).map((ev, i) => (
            <motion.li
              key={ev.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="relative py-1.5"
            >
              <span className={`absolute -left-[18px] top-3 size-2 rounded-full ${i === step ? "bg-primary shadow-[0_0_10px_oklch(0.62_0.18_258_/_0.7)]" : "bg-foreground/30"}`} />
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{ev.kind.replace(/_/g, " ")}</div>
              <div className="text-[13px] text-foreground/90">{ev.title}</div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </div>
  );
}
