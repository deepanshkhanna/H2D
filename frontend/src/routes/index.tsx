import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Grain, Mono, ConfidenceLabel, MoneyExposure, EvidenceChip, StatusPill, SectionLabel } from "@/components/forensic/primitives";
import { InvestigationWall } from "@/components/forensic/InvestigationWall";
import { strengthForConfidence, shortHash } from "@/lib/strength";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OpsPilot AI — Find what everyone else missed" },
      {
        name: "description",
        content:
          "OpsPilot AI reconstructs operational incidents from invoices, emails, manifests, and photos. Every conclusion includes evidence.",
      },
      { property: "og:title", content: "OpsPilot AI — Find what everyone else missed" },
      {
        property: "og:description",
        content:
          "OpsPilot AI reconstructs operational incidents from invoices, emails, manifests, and photos. Every conclusion includes evidence.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-foreground">
      <Nav />
      <Hero />
      <SampleCase />
      <ConsolePreview />
      <Trust />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <nav className="fixed top-0 z-50 w-full border-b border-border/40 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 text-foreground">
          <span className="size-2 rounded-full bg-primary shadow-[0_0_12px_oklch(0.62_0.18_258_/_0.6)]" />
          <span className="font-medium tracking-tight">OpsPilot</span>
        </Link>
        <div className="hidden md:flex gap-7 text-sm text-muted-foreground">
          <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
          <a href="#evidence" className="hover:text-foreground transition-colors">Evidence</a>
          <a href="#console" className="hover:text-foreground transition-colors">Console</a>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/demo" className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5">
            Live Demo
          </Link>
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5">
            Sign in
          </Link>
          <Link
            to="/login"
            className="text-sm font-medium rounded-md bg-primary text-primary-foreground ring-1 ring-primary/60 shadow-[0_0_24px_-8px_oklch(0.62_0.18_258_/_0.6)] px-3.5 py-1.5 hover:bg-primary/90 transition-colors"
          >
            Open Console
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-24 border-b border-border/40">
      <Grain />
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 lg:grid-cols-[minmax(0,_0.85fr)_minmax(0,_1fr)] gap-12 px-6 items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full ring-1 ring-border/60 bg-surface/60 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-8">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            Evidence Correlation Engine
          </div>
          <h1 className="text-balance text-5xl md:text-6xl font-medium tracking-tight leading-[1.05] text-foreground">
            Find what everyone <span className="text-muted-foreground/70">else missed.</span>
          </h1>
          <p className="mt-6 max-w-md text-base text-muted-foreground leading-relaxed text-pretty">
            OpsPilot AI reconstructs operational incidents from invoices, emails, manifests, and photos.
            Every conclusion includes evidence.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground ring-1 ring-primary/70 shadow-[0_0_30px_-8px_oklch(0.62_0.18_258_/_0.7)] px-4 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Open a Case
              <span aria-hidden>→</span>
            </Link>
            <a
              href="#evidence"
              className="inline-flex items-center rounded-md bg-surface ring-1 ring-border/60 px-4 py-2.5 text-sm font-medium text-foreground/80 hover:bg-surface-2 transition-colors"
            >
              See a Conclusion
            </a>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="size-1 rounded-full bg-foreground/60" /> Inspectable reasoning</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-1 rounded-full bg-foreground/60" /> Source provenance on every claim</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-1 rounded-full bg-foreground/60" /> Financial exposure surfaced</span>
          </div>
        </div>
        <div className="relative">
          <InvestigationWall />
        </div>
      </div>
    </section>
  );
}

function SampleCase() {
  const confidence = 94;
  const strength = strengthForConfidence(confidence);
  return (
    <section id="evidence" className="py-28 border-b border-border/40">
      <div className="mx-auto max-w-7xl px-6 grid grid-cols-1 lg:grid-cols-[minmax(0,_0.55fr)_minmax(0,_1fr)] gap-14 items-start">
        <div className="lg:sticky lg:top-28">
          <SectionLabel>Case Conclusion · CASE-4402</SectionLabel>
          <h2 className="text-3xl md:text-4xl font-medium tracking-tight text-foreground">
            Evidence assembled, not alerts surfaced.
          </h2>
          <p className="mt-5 max-w-md text-sm text-muted-foreground leading-relaxed">
            OpsPilot delivers the conclusion first — root cause, money at risk, recommended action — and
            keeps the entire chain of proof one click away. Every claim cites the file, line, or
            timestamp it came from.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-3"><span className="mt-1.5 size-1 rounded-full bg-primary" />Confidence shown as both a number and a word: strong, confirmed, likely, weak.</li>
            <li className="flex items-start gap-3"><span className="mt-1.5 size-1 rounded-full bg-primary" />Anything below 70% routes to <span className="text-foreground">Needs Human Review</span>.</li>
            <li className="flex items-start gap-3"><span className="mt-1.5 size-1 rounded-full bg-primary" />Every conclusion footers with model, UTC time, and input hash.</li>
          </ul>
        </div>

        <div className="rounded-xl bg-surface ring-1 ring-border/60 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
            <div className="flex items-center gap-3">
              <StatusPill status="review_needed" />
              <span className="font-mono text-[11px] text-muted-foreground">CASE-4402 · SHP-10488</span>
            </div>
            <ConfidenceLabel confidence={confidence} label={strength} compact />
          </div>
          <div className="px-6 pt-6 pb-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em]">
              <span className="size-1.5 rounded-full bg-destructive" />
              High Risk Incident
            </div>
            <h3 className="mt-3 text-xl font-medium text-foreground">
              13-unit shortage confirmed across invoice and complaint.
            </h3>
          </div>

          <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 border-b border-border/40">
            <div className="space-y-5">
              <div>
                <Mono>Root Cause</Mono>
                <p className="mt-2 text-sm text-foreground/90 leading-relaxed">
                  Invoice INV-9204 billed 42 units; complaint from buyer@acme.co reports 29 received.
                  Dock camera at 02:14 UTC shows a partial pallet on the loading bay floor matching the
                  shortfall.
                </p>
              </div>
              <div>
                <Mono>Reasoning</Mono>
                <p className="mt-2 text-sm text-foreground/80 leading-relaxed">
                  Shipment ID SHP-10488 appears in all three sources. Quantity discrepancy (42 → 29)
                  matches the visual evidence and the complaint timestamp aligns with the dock event window.
                </p>
              </div>
              <div>
                <Mono>Evidence Chain</Mono>
                <div className="mt-2 flex flex-wrap gap-2">
                  <EvidenceChip label="Invoice · INV-9204.pdf" tone="primary" />
                  <EvidenceChip label="Email · complaint" tone="warning" />
                  <EvidenceChip label="Photo · dock_cam_03" tone="warning" />
                  <EvidenceChip label="Manifest · BL-44821" />
                </div>
              </div>
            </div>
            <div className="md:w-56 flex flex-col gap-5 md:border-l md:border-border/40 md:pl-6">
              <MoneyExposure cents={6360000} size="lg" />
              <div>
                <Mono>Recommended Action</Mono>
                <button className="mt-2 w-full rounded-md bg-foreground text-background text-xs font-semibold py-2.5 hover:bg-foreground/90 transition-colors">
                  Initiate Recovery Workflow
                </button>
              </div>
            </div>
          </div>

          <div className="px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground bg-background/40">
            <span>Generated using <span className="text-foreground/80">Gemini 3 Flash</span></span>
            <span>14:03 UTC</span>
            <span>Hash {shortHash("6F8D2A1B")}</span>
            <span>Sources: Invoice · Complaint · Photo · Manifest</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function ConsolePreview() {
  return (
    <section id="console" className="py-28 border-b border-border/40 bg-background">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,_0.5fr)_minmax(0,_1fr)] gap-12 items-center">
          <div>
            <SectionLabel>Investigator Console</SectionLabel>
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight">
              The conclusion first. The proof on demand.
            </h2>
            <p className="mt-5 max-w-md text-sm text-muted-foreground leading-relaxed">
              Cases open with the primary conclusion at the top — risk, exposure, root cause. The
              evidence graph lives below, ready when you need to inspect. The playback shows exactly
              how OpsPilot reached the answer, step by step.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <Stat n="01" label="Conclusion" />
              <Stat n="02" label="Evidence" />
              <Stat n="03" label="Playback" />
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl bg-surface ring-1 ring-border/60 shadow-2xl overflow-hidden aspect-[16/10]"
          >
            <div className="grid h-full grid-cols-[240px_1fr_280px] grid-rows-[auto_1fr_56px]">
              <div className="col-span-3 flex items-center gap-3 border-b border-border/40 px-4 py-2.5">
                <StatusPill status="correlating" />
                <span className="font-mono text-[10px] text-muted-foreground">CASE-4402 · 13-unit shortage</span>
                <div className="ml-auto flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-warning" />
                  2 need review
                </div>
              </div>
              <div className="border-r border-border/40 p-3 space-y-2">
                <Mono>Evidence Sources</Mono>
                {["Invoice · INV-9204", "Email · complaint", "Photo · dock_cam_03", "Manifest · BL-44821"].map((s) => (
                  <div key={s} className="rounded-md bg-background/60 ring-1 ring-border/40 px-2.5 py-2 text-[11px] text-foreground/80">{s}</div>
                ))}
              </div>
              <div className="relative p-4">
                <div className="absolute inset-0 dot-grid opacity-50" />
                <div className="relative h-full flex items-center justify-center">
                  <div className="rounded-lg bg-background/80 ring-1 ring-primary/40 shadow-[0_0_40px_-10px_oklch(0.62_0.18_258_/_0.55)] px-5 py-4 backdrop-blur-sm">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] mb-2">
                      <span className="size-1.5 rounded-full bg-destructive" />
                      High Risk
                    </div>
                    <div className="text-[13px] font-medium text-foreground">13-unit shortage · SHP-10488</div>
                    <div className="mt-2 flex items-baseline gap-4 text-[11px] font-mono">
                      <span className="text-primary">94% Confirmed</span>
                      <span className="text-foreground/80">$63,600</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="border-l border-border/40 p-3 space-y-3">
                <Mono>Case Conclusions</Mono>
                <div className="rounded-md bg-background/60 ring-1 ring-primary/30 p-2.5">
                  <div className="text-[11px] font-medium text-foreground leading-snug">13-unit shortage</div>
                  <div className="mt-1 font-mono text-[10px] text-primary">94% · $63,600</div>
                </div>
                <div className="rounded-md bg-background/60 ring-1 ring-warning/30 p-2.5">
                  <div className="text-[11px] font-medium text-foreground leading-snug">Carrier docking mismatch</div>
                  <div className="mt-1 font-mono text-[10px] text-warning">76% · $4,200</div>
                </div>
              </div>
              <div className="col-span-3 border-t border-border/40 flex items-center px-4 gap-4">
                <Mono>Audit Trail</Mono>
                <div className="relative flex-1 h-px bg-border/50">
                  <div className="absolute left-[12%] -top-[3px] size-1.5 rounded-full bg-foreground/60" />
                  <div className="absolute left-[28%] -top-[3px] size-1.5 rounded-full bg-foreground/60" />
                  <div className="absolute left-[52%] -top-[3px] size-1.5 rounded-full bg-warning" />
                  <div className="absolute left-[78%] -top-[3px] size-1.5 rounded-full bg-primary shadow-[0_0_10px_oklch(0.62_0.18_258_/_0.6)]" />
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">14:03 UTC</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="rounded-md bg-surface ring-1 ring-border/50 px-3 py-3">
      <div className="font-mono text-[10px] text-primary">{n}</div>
      <div className="mt-1 text-[12px] text-foreground/80">{label}</div>
    </div>
  );
}

function Trust() {
  return (
    <section id="how" className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-border/40 rounded-xl overflow-hidden ring-1 ring-border/40">
          {[
            { k: "01", t: "Upload Evidence", d: "Invoices, emails, manifests, inspection reports, damage photos." },
            { k: "02", t: "Extract Entities", d: "Shipment IDs, amounts, vendors, timestamps, parties." },
            { k: "03", t: "Correlate", d: "Match across sources to surface the actual story." },
            { k: "04", t: "Conclude with Proof", d: "Conclusions cite every file they're built on." },
          ].map((s) => (
            <div key={s.k} className="bg-background p-6">
              <div className="font-mono text-[10px] text-primary uppercase tracking-[0.18em]">{s.k}</div>
              <div className="mt-3 text-[15px] font-medium text-foreground">{s.t}</div>
              <p className="mt-2 text-[13px] text-muted-foreground leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/40 py-10">
      <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          <span className="text-foreground">OpsPilot</span>
          <span className="mx-1">·</span>
          <span>Evidence Correlation Engine</span>
        </div>
        <div className="flex gap-6 text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
          <a href="#" className="hover:text-foreground">Security</a>
          <a href="#" className="hover:text-foreground">Privacy</a>
          <a href="#" className="hover:text-foreground">Audit</a>
        </div>
      </div>
    </footer>
  );
}
