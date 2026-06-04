import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCase, uploadEvidence, extractEvidence, correlate } from "@/lib/cases.functions";
import {
  Mono, StatusPill, MoneyExposure, ConfidenceLabel, EvidenceChip, SectionLabel,
} from "@/components/forensic/primitives";
import { strengthForConfidence, formatMoneyCents, shortHash, STATUS_LABEL } from "@/lib/strength";
import { toast } from "sonner";

const caseQuery = (id: string) =>
  queryOptions({ queryKey: ["case", id], queryFn: () => getCase({ data: { id } }) });

export const Route = createFileRoute("/_authenticated/cases/$caseId")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(caseQuery(params.caseId)),
  component: CaseDetail,
});

const KINDS = ["invoice", "email", "manifest", "inspection", "photo", "other"] as const;

function CaseDetail() {
  const { caseId } = Route.useParams();
  const { data } = useSuspenseQuery(caseQuery(caseId));
  const qc = useQueryClient();

  const upload = useServerFn(uploadEvidence);
  const extract = useServerFn(extractEvidence);
  const correlateFn = useServerFn(correlate);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["case", caseId] });

  const uploadM = useMutation({
    mutationFn: async ({ file, kind }: { file: File; kind: string }) => {
      const buf = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const ev = await upload({ data: { caseId, filename: file.name, kind, contentBase64: b64, mimeType: file.type || "application/octet-stream" } });
      await extract({ data: { evidenceId: (ev as any).id } });
    },
    onSuccess: () => { invalidate(); toast.success("Evidence extracted"); },
    onError: (e) => toast.error((e as Error).message),
  });

  const correlateM = useMutation({
    mutationFn: () => correlateFn({ data: { caseId } }),
    onSuccess: () => { invalidate(); toast.success("Correlation complete"); },
    onError: (e) => toast.error((e as Error).message),
  });

  const primary = data.conclusions.find((c: any) => c.is_primary) ?? data.conclusions[0];
  const others = data.conclusions.filter((c: any) => c.id !== primary?.id);
  const needsReview = data.conclusions.filter((c: any) => c.needs_human_review).length;

  // Build links from conclusion → evidence
  const linksByConclusion = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const l of data.links as any[]) {
      const arr = m.get(l.conclusion_id) ?? [];
      arr.push(l.evidence_id);
      m.set(l.conclusion_id, arr);
    }
    return m;
  }, [data.links]);

  const evById = useMemo(() => new Map((data.evidence as any[]).map((e) => [e.id, e])), [data.evidence]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      {/* Case Header */}
      <div className="flex items-center gap-3 mb-6">
        <StatusPill status={data.case.status} />
        <span className="font-mono text-[11px] text-muted-foreground">{data.case.reference}</span>
        {needsReview > 0 && (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-warning/10 text-warning ring-1 ring-warning/30 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em]">
            <span className="size-1.5 rounded-full bg-warning animate-pulse" />
            {needsReview} needs review
          </span>
        )}
      </div>
      <h1 className="text-2xl md:text-3xl font-medium tracking-tight mb-8">{data.case.title}</h1>

      {/* Primary Conclusion — the hero of the page */}
      {primary ? (
        <PrimaryConclusion conclusion={primary} evIds={linksByConclusion.get(primary.id) ?? []} evById={evById} caseRef={data.case.reference} />
      ) : (
        <EmptyState
          evidenceCount={data.evidence.length}
          canCorrelate={data.evidence.filter((e: any) => e.status === "extracted").length >= 1}
          onCorrelate={() => correlateM.mutate()}
          correlating={correlateM.isPending}
        />
      )}

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        {/* Left: Evidence Sources */}
        <aside className="space-y-4">
          <SectionLabel>Evidence Sources</SectionLabel>
          <UploadBox onUpload={(file, kind) => uploadM.mutate({ file, kind })} busy={uploadM.isPending} />
          <div className="space-y-1.5">
            {data.evidence.map((e: any) => (
              <EvidenceRow key={e.id} ev={e} />
            ))}
            {data.evidence.length === 0 && (
              <div className="text-[12px] text-muted-foreground italic">No evidence yet.</div>
            )}
          </div>
          {data.evidence.filter((e: any) => e.status === "extracted").length >= 1 && (
            <button
              onClick={() => correlateM.mutate()}
              disabled={correlateM.isPending}
              className="w-full rounded-md bg-primary text-primary-foreground ring-1 ring-primary/70 shadow-[0_0_24px_-10px_oklch(0.62_0.18_258_/_0.6)] px-3 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {correlateM.isPending ? "Correlating…" : "Run Correlation"}
            </button>
          )}
        </aside>

        {/* Right: other conclusions + graph + playback + audit */}
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

          {data.evidence.length > 0 && (
            <section>
              <SectionLabel>Evidence Graph</SectionLabel>
              <EvidenceGraph evidence={data.evidence} conclusions={data.conclusions} links={data.links} />
            </section>
          )}

          {data.events.length > 0 && (
            <section>
              <SectionLabel>Investigation Playback</SectionLabel>
              <Playback events={data.events} />
            </section>
          )}

          {data.events.length > 0 && (
            <section>
              <SectionLabel>Audit Trail</SectionLabel>
              <ol className="rounded-lg bg-surface ring-1 ring-border/40 divide-y divide-border/40">
                {data.events.map((ev: any) => (
                  <li key={ev.id} className="px-4 py-2.5 flex items-baseline gap-4 text-[12px]">
                    <span className="font-mono text-[10px] text-muted-foreground w-32 shrink-0">
                      {new Date(ev.occurred_at).toLocaleString()}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary w-32 shrink-0">{ev.kind.replace(/_/g, " ")}</span>
                    <span className="text-foreground/85">{ev.title}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

function PrimaryConclusion({ conclusion: c, evIds, evById, caseRef }: any) {
  const strength = strengthForConfidence(Number(c.confidence));
  return (
    <div className="rounded-xl bg-surface ring-1 ring-primary/30 shadow-[0_0_60px_-20px_oklch(0.62_0.18_258_/_0.45)] overflow-hidden">
      <div className="px-6 pt-6 pb-2 flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em]">
            <span className="size-1.5 rounded-full bg-destructive" />
            {c.severity === "critical" || c.severity === "high" ? "High Risk Incident" : c.severity === "medium" ? "Notable Risk" : "Low Risk"}
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
              <button className="mt-2 w-full rounded-md bg-foreground text-background text-xs font-semibold py-2.5 hover:bg-foreground/90 transition-colors text-left px-3">
                {c.recommended_action}
              </button>
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
      <div className="px-5 py-4 flex items-start justify-between gap-4 border-b border-border/40">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {c.needs_human_review && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 text-warning ring-1 ring-warning/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em]">Review</span>
            )}
          </div>
          <div className="text-[15px] font-medium text-foreground">{c.title}</div>
        </div>
        <ConfidenceLabel confidence={Number(c.confidence)} label={strength} compact />
      </div>
      <div className="px-5 py-4 space-y-3 text-sm">
        <p className="text-foreground/80 leading-relaxed">{c.root_cause}</p>
        <div className="flex items-center justify-between gap-4">
          <MoneyExposure cents={Number(c.financial_exposure_cents)} label="Exposure" size="sm" />
          <div className="flex flex-wrap gap-1.5 justify-end">
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

function UploadBox({ onUpload, busy }: { onUpload: (f: File, kind: string) => void; busy: boolean }) {
  const [kind, setKind] = useState<typeof KINDS[number]>("invoice");
  return (
    <label className="block rounded-md bg-surface-2 ring-1 ring-dashed ring-border/70 p-4 text-center cursor-pointer hover:ring-primary/40 transition-colors">
      <div className="text-[11px] font-mono uppercase tracking-[0.16em] text-muted-foreground mb-2">
        {busy ? "Extracting evidence…" : "Add Evidence"}
      </div>
      <select
        value={kind}
        onChange={(e) => setKind(e.target.value as any)}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface ring-1 ring-border/60 text-[11px] rounded px-2 py-1 mb-2"
      >
        {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
      </select>
      <input
        type="file"
        className="hidden"
        disabled={busy}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f, kind); e.target.value = ""; }}
      />
      <div className="text-[10px] text-muted-foreground">Click to upload · text files extract richest</div>
    </label>
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

function EmptyState({ evidenceCount, canCorrelate, onCorrelate, correlating }: any) {
  return (
    <div className="rounded-xl bg-surface ring-1 ring-border/50 p-10 text-center">
      <Mono>No conclusion yet</Mono>
      <h2 className="mt-3 text-xl font-medium text-foreground">
        {evidenceCount === 0 ? "Upload evidence to begin." : canCorrelate ? "Evidence ready. Run correlation." : "Extracting evidence…"}
      </h2>
      {canCorrelate && (
        <button
          onClick={onCorrelate}
          disabled={correlating}
          className="mt-5 rounded-md bg-primary text-primary-foreground ring-1 ring-primary/70 px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
        >
          {correlating ? "Correlating…" : "Run Correlation"}
        </button>
      )}
    </div>
  );
}

function EvidenceGraph({ evidence, conclusions, links }: any) {
  // Calm SVG: evidence nodes around a primary conclusion node, edges from conclusion→evidence
  const primary = conclusions.find((c: any) => c.is_primary) ?? conclusions[0];
  const N = evidence.length;
  const cx = 50, cy = 50, r = 36;
  const evPos = evidence.map((e: any, i: number) => {
    const angle = (i / Math.max(N, 1)) * Math.PI * 2 - Math.PI / 2;
    return { ...e, x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  });
  const primaryLinks = new Set((links as any[]).filter((l) => l.conclusion_id === primary?.id).map((l) => l.evidence_id));

  return (
    <div className="rounded-lg bg-surface ring-1 ring-border/40 dot-grid p-6 aspect-[2/1] relative overflow-hidden">
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        {evPos.map((e: any) => (
          <line key={e.id} x1={cx} y1={cy} x2={e.x} y2={e.y}
            stroke={primaryLinks.has(e.id) ? "oklch(0.62 0.18 258)" : "oklch(0.27 0.012 270)"}
            strokeOpacity={primaryLinks.has(e.id) ? 0.5 : 0.35}
            strokeWidth={primaryLinks.has(e.id) ? 0.3 : 0.2}
          />
        ))}
        {primary && (
          <circle cx={cx} cy={cy} r={3} fill="oklch(0.62 0.18 258)" />
        )}
        {evPos.map((e: any) => (
          <circle key={e.id} cx={e.x} cy={e.y} r={1.8}
            fill={primaryLinks.has(e.id) ? "oklch(0.97 0.005 270)" : "oklch(0.62 0.015 270)"} />
        ))}
      </svg>
      <div className="absolute bottom-3 left-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {N} evidence · {conclusions.length} conclusion(s)
      </div>
    </div>
  );
}

function Playback({ events }: { events: any[] }) {
  const [step, setStep] = useState(events.length - 1);
  return (
    <div className="rounded-lg bg-surface ring-1 ring-border/40 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Step {step + 1} of {events.length}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setStep(0)}
            className="rounded bg-surface-2 ring-1 ring-border/60 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.14em] hover:bg-surface transition-colors"
          >Reset</button>
          <button
            onClick={async () => {
              for (let i = 0; i < events.length; i++) {
                await new Promise((r) => setTimeout(r, 900));
                setStep(i);
              }
            }}
            className="rounded bg-primary text-primary-foreground ring-1 ring-primary/70 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.14em] hover:bg-primary/90 transition-colors"
          >Play ▸</button>
        </div>
      </div>
      <ol className="relative pl-6">
        <div className="absolute left-2 top-0 bottom-0 w-px bg-border/40" />
        <AnimatePresence>
          {events.slice(0, step + 1).map((ev: any, i: number) => (
            <motion.li
              key={ev.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative py-2"
            >
              <span className={`absolute -left-[18px] top-3 size-2 rounded-full ${i === step ? "bg-primary shadow-[0_0_10px_oklch(0.62_0.18_258_/_0.7)]" : "bg-foreground/40"}`} />
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{ev.kind.replace(/_/g, " ")}</div>
              <div className="text-[13px] text-foreground/90">{ev.title}</div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </div>
  );
}
