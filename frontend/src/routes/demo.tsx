/**
 * /demo — Fully interactive OpsPilot AI demo.
 *
 * Combines the original tabbed design system, typography, and visual layout of the
 * landing page with backend API file upload, progress polling, and terminal streaming.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mono,
  StatusPill,
  MoneyExposure,
  ConfidenceLabel,
  EvidenceChip,
  SectionLabel,
  Grain,
} from "@/components/forensic/primitives";
import { strengthForConfidence, shortHash } from "@/lib/strength";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Live Demo — OpsPilot AI" },
      {
        name: "description",
        content:
          "Reconstruct operational incidents in real-time. Upload your evidence and watch OpsPilot AI correlate it.",
      },
    ],
  }),
  component: DemoPage,
});

const API = "http://localhost:8000";

// ─── Stage display labels ─────────────────────────────────────────────────────
const STAGE_LABELS: Record<string, string> = {
  queued: "Queued — waiting for pipeline",
  files_stored: "Files stored securely",
  invoice_parsed: "Invoice parsed — entities extracted",
  email_parsed: "Complaint email parsed",
  image_analyzed: "Damage photo analyzed by Gemini Vision",
  entities_extracted: "Entities extracted across all documents",
  entities_normalized: "Entities normalized and deduplicated",
  links_scored: "Cross-document links scored",
  risk_scored: "Risk model calculated",
  graph_generated: "Evidence graph generated",
  completed: "Analysis complete",
  failed: "Pipeline failed",
};

// ─── Helper: pretty file size ─────────────────────────────────────────────────
function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface GraphNode {
  id: string;
  type: string;
  subtype?: string;
  label: string;
  description?: string;
  confidence: number;
  severity?: string;
  data?: Record<string, any>;
  source_ref_ids?: string[];
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label: string;
  confidence: number;
  status: string;
  confidence_breakdown?: any;
}

interface Explanation {
  id: string;
  summary: string;
  why: string[];
  uncertainty: string[];
  recommended_action: string;
  risk_score: number;
  risk_label: string;
  supporting_evidence?: any[];
  conflicting_evidence?: any[];
  recommendations?: any[];
  executive_summary?: string;
  timeline_reconstruction?: Array<{ timestamp: string; event: string; evidence_source: string }>;
  evidence_consistency?: Array<{
    item: string;
    details: string;
    status: string;
    confidence: number;
  }>;
  contradiction_analysis?: Array<{
    conflict: string;
    source_a: string;
    source_b: string;
    resolution: string;
  }>;
  financial_impact?: { estimated_loss: number; currency: string; breakdown: string };
  root_cause_hypotheses?: Array<{
    hypothesis: string;
    confidence: number;
    supporting_evidence: string[];
    negating_evidence: string[];
  }>;
  prioritized_actions?: Array<{
    priority: string;
    action: string;
    rationale: string;
    evidence_ref: string;
  }>;
  investigation_narrative?: string;
  best_explanation?: string;
  competing_hypotheses?: Array<{
    hypothesis: string;
    confidence: number;
    supporting_evidence: string[];
    negating_evidence: string[];
  }>;
}

interface EvidenceGraph {
  metadata: { incident_id: string; job_id: string; input_hash?: string; created_at?: string };
  nodes: GraphNode[];
  edges: GraphEdge[];
  explanations: Explanation[];
  source_refs?: any[];
}

interface JobEvent {
  id?: string;
  stage: string;
  message: string;
  duration_ms?: number;
  created_at?: string;
}

interface JobStatus {
  id: string;
  incident_id: string;
  status: string;
  stage: string;
  progress: number;
  error?: string;
  events: JobEvent[];
}

type Phase = "upload" | "processing" | "done" | "error";

function DemoPage() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [files, setFiles] = useState<{ invoice?: File; email?: File; image?: File }>({});
  const [dragOver, setDragOver] = useState(false);
  const [termLog, setTermLog] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [graph, setGraph] = useState<EvidenceGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [entityFilter, setEntityFilter] = useState("all");
  const [tab, setTab] = useState<"case" | "entities">("case");
  const [pipelineEvents, setPipelineEvents] = useState<
    Record<string, { completed: boolean; duration?: number; message?: string }>
  >({});

  const [auditPanelOpen, setAuditPanelOpen] = useState(false);

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
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [termLog]);

  // Cleanup polling on unmount
  useEffect(
    () => () => {
      cancelRef.current = true;
      if (pollRef.current) clearInterval(pollRef.current);
    },
    [],
  );

  function addLog(msg: string) {
    setTermLog((p) => [...p, msg]);
  }

  // ── File handling ──────────────────────────────────────────────────────────
  function classifyFile(file: File): keyof typeof files | null {
    const n = file.name.toLowerCase();
    const t = file.type.toLowerCase();
    if (t.includes("image") || n.match(/\.(jpg|jpeg|png|webp|gif)$/)) return "image";
    if (t.includes("pdf") || n.match(/\.(pdf|txt)$/) || n.includes("invoice")) return "invoice";
    if (
      t.includes("message") ||
      n.match(/\.(eml|msg)$/) ||
      n.includes("email") ||
      n.includes("complaint")
    )
      return "email";
    return "invoice"; // default
  }

  function handleFiles(incoming: FileList | null) {
    if (!incoming) return;
    const updated = { ...files };
    Array.from(incoming)
      .slice(0, 3)
      .forEach((f) => {
        const role = classifyFile(f);
        if (role) updated[role] = f;
      });
    setFiles(updated);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  // ── Upload + Start Pipeline ────────────────────────────────────────────────
  async function startProcessing() {
    const hasFiles = Object.values(files).some(Boolean);
    if (!hasFiles) return;

    cancelRef.current = false;
    setPhase("processing");
    setTermLog([]);
    setPipelineEvents({});
    setProgress(0);

    addLog("$ opspilot upload — initiating secure transfer");

    const form = new FormData();
    if (files.invoice) {
      form.append("invoice_pdf", files.invoice, files.invoice.name);
      addLog(`  ↑ invoice   ${files.invoice.name} (${fmtSize(files.invoice.size)})`);
    }
    if (files.email) {
      form.append("complaint_email", files.email, files.email.name);
      addLog(`  ↑ email     ${files.email.name} (${fmtSize(files.email.size)})`);
    }
    if (files.image) {
      form.append("damage_image", files.image, files.image.name);
      addLog(`  ↑ image     ${files.image.name} (${fmtSize(files.image.size)})`);
    }

    let jobId: string;
    let incidentId: string;

    try {
      addLog("$ POST /api/incidents — launching correlation pipeline…");
      const res = await fetch(`${API}/api/incidents`, { method: "POST", body: form });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Upload failed (${res.status}): ${txt}`);
      }
      const data = await res.json();
      jobId = data.job_id;
      incidentId = data.incident_id;
      addLog(`✓ Job created: ${jobId.slice(0, 8)}…`);
      addLog(`  Incident ID: ${incidentId}`);
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog(`✗ Error: ${msg}`);
      setError(msg);
      setPhase("error");
      return;
    }

    // Poll for progress
    const seenStages = new Set<string>();
    addLog("$ polling job status every 1.5 s…");

    pollRef.current = setInterval(async () => {
      if (cancelRef.current) {
        if (pollRef.current) clearInterval(pollRef.current);
        return;
      }

      try {
        const res = await fetch(`${API}/api/jobs/${jobId}`);
        if (!res.ok) throw new Error(`Job poll failed (${res.status})`);
        const job: JobStatus = await res.json();

        // Log new events & save timings
        const updatedEvs = { ...pipelineEvents };
        for (const ev of job.events) {
          const key = `${ev.stage}:${ev.message}`;
          if (!seenStages.has(key)) {
            seenStages.add(key);
            addLog(`  [${ev.stage}] ${STAGE_LABELS[ev.stage] ?? ev.stage}: ${ev.message}`);
          }
          updatedEvs[ev.stage] = {
            completed: true,
            duration: ev.duration_ms,
            message: ev.message,
          };
        }
        setPipelineEvents(updatedEvs);
        setProgress(job.progress ?? 0);

        if (job.status === "failed") {
          clearInterval(pollRef.current!);
          addLog(`✗ Pipeline failed: ${job.error ?? "unknown error"}`);
          setError(job.error ?? "Pipeline failed");
          setPhase("error");
          return;
        }

        if (job.status === "completed") {
          clearInterval(pollRef.current!);
          addLog("✓ Pipeline complete — fetching evidence graph…");
          await fetchGraph(incidentId);
        }
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : String(e);
        addLog(`⚠ Poll error: ${msg}`);
      }
    }, 1500);
  }

  async function fetchGraph(incidentId: string) {
    try {
      const res = await fetch(`${API}/api/incidents/${incidentId}/graph`);
      if (!res.ok) throw new Error(`Graph fetch failed (${res.status})`);
      const g: EvidenceGraph = await res.json();
      addLog(`✓ Graph loaded — ${g.nodes.length} nodes, ${g.edges.length} edges`);
      setGraph(g);
      setPhase("done");
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog(`✗ Graph error: ${msg}`);
      setError(msg);
      setPhase("error");
    }
  }

  // ── Load pre-built demo case (fully simulated loader) ──────────────────────
  async function loadDemo() {
    cancelRef.current = false;
    setPhase("processing");
    setTermLog([]);
    setPipelineEvents({});
    setProgress(0);

    addLog("$ opspilot demo — requesting demo case load…");

    let jobId: string;
    let incidentId: string;

    try {
      const res = await fetch(`${API}/api/demo/load`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to load demo resources on the backend.");
      const data = await res.json();
      jobId = data.job_id;
      incidentId = data.incident_id;
      addLog(`✓ Pre-built case instantiated: ${incidentId}`);
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog(`✗ Demo load failed: ${msg}`);
      setError(msg);
      setPhase("error");
      return;
    }

    // High-fidelity UI simulation of logs to keep the user engaged
    const steps = [
      {
        p: 8,
        s: "files_stored",
        l: "Stored 3 files: invoice_SHP-10488.txt, complaint_email_SHP-10488.eml, damage_photo.jpg",
        d: 150,
      },
      {
        p: 20,
        s: "invoice_parsed",
        l: "Invoice parsed: 1 pages, 420 chars parsed, PO-9204 found",
        d: 920,
      },
      {
        p: 30,
        s: "email_parsed",
        l: "Complaint email parsed: subject='Urgent Shortage Complaint - SHP-10488'",
        d: 350,
      },
      {
        p: 42,
        s: "image_analyzed",
        l: "Image analyzed: 2 damage labels detected (crushed corner, water damage)",
        d: 2200,
      },
      {
        p: 56,
        s: "entities_extracted",
        l: "Extracted 12 entity mentions across all documents",
        d: 1400,
      },
      { p: 65, s: "entities_normalized", l: "Normalized to 8 canonical entities", d: 450 },
      { p: 75, s: "links_scored", l: "Scored 5 candidate links (3 confirmed, 1 probable)", d: 800 },
      { p: 85, s: "risk_scored", l: "Risk model calculated: HIGH RISK (87/100)", d: 650 },
      { p: 95, s: "graph_generated", l: "Evidence graph built: 11 nodes, 15 edges", d: 1100 },
    ];

    let i = 0;
    const interval = setInterval(async () => {
      if (cancelRef.current) {
        clearInterval(interval);
        return;
      }

      if (i < steps.length) {
        const step = steps[i];
        setProgress(step.p);
        addLog(`  [${step.s}] ${STAGE_LABELS[step.s] ?? step.s}: ${step.l}`);
        setPipelineEvents((prev) => ({
          ...prev,
          [step.s]: {
            completed: true,
            duration: step.d,
            message: step.l,
          },
        }));
        i++;
      } else {
        clearInterval(interval);
        setProgress(100);
        addLog("✓ Pipeline complete — fetching pre-built evidence graph…");
        try {
          const res = await fetch(`${API}/api/demo/graph`);
          if (!res.ok) throw new Error(`Demo graph failed (${res.status})`);
          const g: EvidenceGraph = await res.json();
          addLog(`✓ Graph loaded: ${g.nodes.length} nodes, ${g.edges.length} edges`);
          setGraph(g);
          setPhase("done");
        } catch (e: any) {
          const msg = e instanceof Error ? e.message : String(e);
          addLog(`✗ ${msg}`);
          setError(msg);
          setPhase("error");
        }
      }
    }, 450);
  }

  function reset() {
    cancelRef.current = true;
    if (pollRef.current) clearInterval(pollRef.current);
    setPhase("upload");
    setFiles({});
    setTermLog([]);
    setProgress(0);
    setGraph(null);
    setError(null);
    setSelectedNodeId(null);
    setTab("case");
  }

  // ── Load case files from public/ and run pipeline ─────────────────────────
  async function loadCaseFiles(caseDir: string, fileMap: { path: string; role: keyof typeof files }[]) {
    try {
      const loaded: Partial<typeof files> = {};
      for (const { path, role } of fileMap) {
        const res = await fetch(path);
        if (!res.ok) throw new Error(`Failed to fetch ${path} (${res.status})`);
        const blob = await res.blob();
        const filename = path.split("/").pop()!;
        const type = filename.endsWith(".pdf") ? "application/pdf"
          : filename.endsWith(".eml") ? "message/rfc822"
          : filename.endsWith(".jpg") || filename.endsWith(".jpeg") ? "image/jpeg"
          : filename.endsWith(".png") ? "image/png"
          : "application/octet-stream";
        loaded[role] = new File([blob], filename, { type });
      }
      setFiles(loaded as typeof files);
      // Small delay to let state update, then trigger analysis
      setTimeout(() => {
        // Call startProcessing with the loaded files directly
        startProcessingWithFiles(loaded as typeof files);
      }, 150);
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setPhase("error");
    }
  }

  // ── startProcessing variant that accepts explicit files ────────────────────
  async function startProcessingWithFiles(fileSet: typeof files) {
    const hasFiles = Object.values(fileSet).some(Boolean);
    if (!hasFiles) return;

    cancelRef.current = false;
    setPhase("processing");
    setTermLog([]);
    setPipelineEvents({});
    setProgress(0);

    addLog("$ opspilot upload — initiating secure transfer");

    const form = new FormData();
    if (fileSet.invoice) {
      form.append("invoice_pdf", fileSet.invoice, fileSet.invoice.name);
      addLog(`  ↑ invoice   ${fileSet.invoice.name} (${fmtSize(fileSet.invoice.size)})`);
    }
    if (fileSet.email) {
      form.append("complaint_email", fileSet.email, fileSet.email.name);
      addLog(`  ↑ email     ${fileSet.email.name} (${fmtSize(fileSet.email.size)})`);
    }
    if (fileSet.image) {
      form.append("damage_image", fileSet.image, fileSet.image.name);
      addLog(`  ↑ image     ${fileSet.image.name} (${fmtSize(fileSet.image.size)})`);
    }

    let jobId: string;
    let incidentId: string;

    try {
      addLog("$ POST /api/incidents — launching correlation pipeline…");
      const res = await fetch(`${API}/api/incidents`, { method: "POST", body: form });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Upload failed (${res.status}): ${txt}`);
      }
      const data = await res.json();
      jobId = data.job_id;
      incidentId = data.incident_id;
      addLog(`✓ Job created: ${jobId.slice(0, 8)}…`);
      addLog(`  Incident ID: ${incidentId}`);
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog(`✗ Error: ${msg}`);
      setError(msg);
      setPhase("error");
      return;
    }

    const seenStages = new Set<string>();
    addLog("$ polling job status every 1.5 s…");

    pollRef.current = setInterval(async () => {
      if (cancelRef.current) {
        if (pollRef.current) clearInterval(pollRef.current);
        return;
      }
      try {
        const res = await fetch(`${API}/api/jobs/${jobId}`);
        if (!res.ok) throw new Error(`Job poll failed (${res.status})`);
        const job: JobStatus = await res.json();

        const updatedEvs = { ...pipelineEvents };
        for (const ev of job.events) {
          const key = `${ev.stage}:${ev.message}`;
          if (!seenStages.has(key)) {
            seenStages.add(key);
            addLog(`  [${ev.stage}] ${STAGE_LABELS[ev.stage] ?? ev.stage}: ${ev.message}`);
          }
          updatedEvs[ev.stage] = { completed: true, duration: ev.duration_ms, message: ev.message };
        }
        setPipelineEvents(updatedEvs);
        setProgress(job.progress ?? 0);

        if (job.status === "failed") {
          clearInterval(pollRef.current!);
          addLog(`✗ Pipeline failed: ${job.error ?? "unknown error"}`);
          setError(job.error ?? "Pipeline failed");
          setPhase("error");
          return;
        }
        if (job.status === "completed") {
          clearInterval(pollRef.current!);
          addLog("✓ Pipeline complete — fetching evidence graph…");
          await fetchGraph(incidentId);
        }
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : String(e);
        addLog(`⚠ Poll error: ${msg}`);
      }
    }, 1500);
  }


  // ── Derived data ───────────────────────────────────────────────────────────
  const primaryConclusion = useMemo(() => graph?.explanations?.[0] ?? null, [graph]);
  const docNodes = useMemo(() => graph?.nodes.filter((n) => n.type === "document") ?? [], [graph]);
  const entityNodes = useMemo(
    () =>
      graph?.nodes.filter(
        (n) => n.type === "entity" || n.type === "observation" || n.type === "anomaly",
      ) ?? [],
    [graph],
  );
  const riskNode = useMemo(() => graph?.nodes.find((n) => n.type === "risk") ?? null, [graph]);

  const filteredEntities = useMemo(() => {
    if (entityFilter === "all") return entityNodes;
    return entityNodes.filter((n) => n.type === entityFilter);
  }, [entityNodes, entityFilter]);

  const selectedNode = useMemo(
    () => graph?.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [graph, selectedNodeId],
  );

  // Convert timeline events from logs for playback component
  const playbackEvents = useMemo(() => {
    if (phase !== "done") return [];
    return termLog
      .filter((l) => l.startsWith("  ["))
      .map((l, index) => {
        const parts = l.split("]: ");
        const stageRaw = l.substring(3, l.indexOf("]"));
        const message = parts[1] ?? l;
        return {
          id: `evt-${index}`,
          kind: stageRaw,
          title: message,
        };
      });
  }, [termLog, phase]);

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-foreground">
      <Grain />

      {/* Nav Header */}
      <nav className="fixed top-0 z-50 w-full border-b border-border/40 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 text-foreground">
            <span className="size-2 rounded-full bg-primary shadow-[0_0_12px_oklch(0.62_0.18_258_/_0.6)]" />
            <span className="font-medium tracking-tight">OpsPilot</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary ring-1 ring-primary/30 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] mr-4">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              Live Demo
            </span>
            <Link
              to="/login"
              className="text-xs font-medium rounded-md bg-primary text-primary-foreground ring-1 ring-primary/60 shadow-[0_0_24px_-8px_oklch(0.62_0.18_258_/_0.6)] px-3.5 py-1.5 hover:bg-primary/90 transition-colors"
            >
              Open Console
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative mx-auto max-w-7xl px-6 pt-24 pb-20">
        {/* ─── UPLOAD VIEW ──────────────────────────────────────────────────── */}
        {phase === "upload" && (
          <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,_0.85fr)_minmax(0,_1fr)] gap-16 items-center pt-8 pb-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full ring-1 ring-border/60 bg-surface/60 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-8">
                <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                Evidence Correlation Engine
              </div>
              <h1 className="text-balance text-4xl md:text-5xl font-medium tracking-tight leading-[1.08] text-foreground">
                Analyze your evidence,{" "}
                <span className="text-muted-foreground/70">find the truth.</span>
              </h1>
              <p className="mt-6 max-w-md text-[15px] text-muted-foreground leading-relaxed text-pretty">
                Upload invoices, customer complaint emails, and damage photos to extract canonical
                entities, normalize records, and build an auditable provenance graph.
              </p>

              <div className="mt-8 space-y-4">
                <div className="flex items-start gap-3 text-sm text-muted-foreground">
                  <span className="mt-1.5 size-1.5 rounded-full bg-primary" />
                  <div>
                    <span className="text-foreground font-medium">Confidence & Risk Scoring:</span>{" "}
                    Assess claims using deterministic weights and model confidence.
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm text-muted-foreground">
                  <span className="mt-1.5 size-1.5 rounded-full bg-primary" />
                  <div>
                    <span className="text-foreground font-medium">Traceable Proof Trail:</span>{" "}
                    Every conclusion automatically cites the exact source files and line spans.
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm text-muted-foreground">
                  <span className="mt-1.5 size-1.5 rounded-full bg-primary" />
                  <div>
                    <span className="text-foreground font-medium">Interactive Playback:</span> Watch
                    the AI extract entities and resolve connections step-by-step.
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-surface/60 ring-1 ring-border/60 shadow-2xl p-6 relative overflow-hidden backdrop-blur-sm">
              <div className="absolute inset-0 dot-grid opacity-30 pointer-events-none" />
              <div className="relative">
                <SectionLabel>Open a new incident</SectionLabel>

                {/* Dropzone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`relative mt-3 rounded-lg border-2 border-dashed transition-all duration-200 p-8 text-center cursor-pointer ${dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border/40 hover:border-border/70 bg-background/40"}`}
                >
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.txt,.eml,.msg,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => handleFiles(e.target.files)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="space-y-2">
                    <div className="text-3xl">📂</div>
                    <div className="text-[13px] text-foreground font-medium">
                      Drag & drop files here, or click to browse
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Invoice PDF · Complaint Email (.eml) · Damage Photo (JPG/PNG)
                    </div>
                  </div>
                </div>

                {/* File list */}
                {Object.entries(files).some(([, v]) => v) && (
                  <div className="mt-6 space-y-2">
                    <Mono>Files Selected</Mono>
                    <div className="space-y-1.5">
                      {(["invoice", "email", "image"] as const).map((role) => {
                        const f = files[role];
                        if (!f) return null;
                        const icons = { invoice: "📄", email: "📧", image: "🖼" };
                        return (
                          <div
                            key={role}
                            className="flex items-center justify-between rounded bg-background/50 ring-1 ring-border/40 px-3 py-2 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base shrink-0">{icons[role]}</span>
                              <span className="truncate font-medium text-foreground">{f.name}</span>
                              <span className="font-mono text-[9px] text-muted-foreground uppercase shrink-0">
                                ({fmtSize(f.size)})
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setFiles((p) => {
                                  const n = { ...p };
                                  delete n[role];
                                  return n;
                                })
                              }
                              className="text-muted-foreground hover:text-foreground text-base px-1.5"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={startProcessing}
                    disabled={!Object.values(files).some(Boolean)}
                    className="w-full rounded-md bg-primary text-primary-foreground font-medium ring-1 ring-primary/70 shadow-[0_0_30px_-8px_oklch(0.62_0.18_258_/_0.7)] py-2.5 text-xs uppercase tracking-wider hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Analyze My Evidence
                  </button>
                  <button
                    type="button"
                    onClick={loadDemo}
                    className="w-full rounded-md bg-surface ring-1 ring-border/60 py-2.5 text-xs font-semibold text-foreground/80 hover:bg-surface-2 transition-colors text-center block uppercase tracking-wider"
                  >
                    Load Pre-built Demo Case
                  </button>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border/30" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-surface/60 px-2 text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
                        or load real test case
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => loadCaseFiles("case1", [
                        { path: "/case1/invoice.pdf", role: "invoice" },
                        { path: "/case1/complaint.eml", role: "email" },
                        { path: "/case1/image.jpg", role: "image" },
                      ])}
                      className="rounded-md bg-surface ring-1 ring-orange-500/30 py-2.5 text-[10px] font-semibold text-orange-400 hover:bg-orange-500/10 transition-colors uppercase tracking-wider"
                      title="Case 1: Transit Damage — smashed package, confirmed physical damage"
                    >
                      📦 Case 1: Transit Damage
                    </button>
                    <button
                      type="button"
                      onClick={() => loadCaseFiles("case2", [
                        { path: "/case2/invoice.pdf", role: "invoice" },
                        { path: "/case2/complaint.eml", role: "email" },
                        { path: "/case2/package.jpg", role: "image" },
                      ])}
                      className="rounded-md bg-surface ring-1 ring-primary/30 py-2.5 text-[10px] font-semibold text-primary hover:bg-primary/10 transition-colors uppercase tracking-wider"
                      title="Case 2: Inventory Shortage — intact package, 20 missing units"
                    >
                      📋 Case 2: Shortage
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </section>
        )}

        {/* ─── PROCESSING VIEW ──────────────────────────────────────────────── */}
        {phase === "processing" && (
          <section className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 pt-8">
            {/* Left: evidence uploading states */}
            <aside className="space-y-4">
              <SectionLabel>Evidence Sources</SectionLabel>
              <div className="space-y-1.5">
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
              </div>
            </aside>

            {/* Right: Pipeline progress & Terminal logs */}
            <div className="space-y-6">
              <div className="rounded-xl bg-surface/60 ring-1 ring-border/60 shadow-xl p-6 backdrop-blur-sm relative">
                <div className="absolute inset-0 dot-grid opacity-25 pointer-events-none" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary ring-1 ring-primary/30 px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.16em]">
                        Pipeline active
                      </span>
                      <h2 className="text-lg font-medium text-foreground mt-1">
                        Incident Correlation Engine
                      </h2>
                    </div>
                    <span className="font-mono text-sm text-primary font-semibold tabular-nums">
                      {progress}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 w-full rounded-full bg-border/40 overflow-hidden mb-6">
                    <div
                      className="h-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  {/* Horizontal Stage indicators with timing details */}
                  <div className="space-y-2 mb-6">
                    <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                      Pipeline Stages Status
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {[
                        { key: "files_stored", label: "Ingestion" },
                        { key: "invoice_parsed", label: "Invoice Parse" },
                        { key: "email_parsed", label: "Email Parse" },
                        { key: "image_analyzed", label: "Vision Parse" },
                        { key: "entities_extracted", label: "Extraction" },
                        { key: "entities_normalized", label: "Normalization" },
                        { key: "links_scored", label: "Correlation" },
                        { key: "risk_scored", label: "Risk Modeler" },
                        { key: "graph_generated", label: "Graph Gen" },
                      ].map((stage, idx) => {
                        const evData = pipelineEvents[stage.key];
                        const isDone = !!evData?.completed;
                        const isCurrent =
                          progress > 0 &&
                          !isDone &&
                          (idx === 0 ||
                            (stage.key === "invoice_parsed" &&
                              progress >= 8 &&
                              !pipelineEvents.invoice_parsed) ||
                            (stage.key === "email_parsed" &&
                              progress >= 20 &&
                              !pipelineEvents.email_parsed) ||
                            (stage.key === "image_analyzed" &&
                              progress >= 30 &&
                              !pipelineEvents.image_analyzed) ||
                            (stage.key === "entities_extracted" &&
                              progress >= 42 &&
                              !pipelineEvents.entities_extracted) ||
                            (stage.key === "entities_normalized" &&
                              progress >= 56 &&
                              !pipelineEvents.entities_normalized) ||
                            (stage.key === "links_scored" &&
                              progress >= 65 &&
                              !pipelineEvents.links_scored) ||
                            (stage.key === "risk_scored" &&
                              progress >= 75 &&
                              !pipelineEvents.risk_scored) ||
                            (stage.key === "graph_generated" &&
                              progress >= 85 &&
                              !pipelineEvents.graph_generated));

                        return (
                          <div
                            key={stage.key}
                            className={`rounded-lg ring-1 px-3 py-2 flex items-center justify-between transition-colors ${isDone ? "bg-primary/5 ring-primary/30" : isCurrent ? "bg-surface ring-primary/20 animate-pulse" : "bg-surface/20 ring-border/20 opacity-40"}`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`size-3 rounded-full flex items-center justify-center text-[7px] font-bold ${isDone ? "bg-primary text-primary-foreground" : isCurrent ? "border border-primary text-primary" : "border border-muted-foreground/30 text-muted-foreground/30"}`}
                              >
                                {isDone ? "✓" : idx + 1}
                              </span>
                              <span
                                className={`text-[10px] font-mono uppercase tracking-wider ${isCurrent ? "text-foreground font-medium" : "text-muted-foreground/50"}`}
                              >
                                {stage.label}
                              </span>
                            </div>
                            {isDone && evData.duration && (
                              <span className="font-mono text-[9px] text-primary shrink-0">
                                {evData.duration >= 1000
                                  ? `${(evData.duration / 1000).toFixed(1)}s`
                                  : `${Math.round(evData.duration)}ms`}
                              </span>
                            )}
                            {isCurrent && (
                              <span className="font-mono text-[8px] text-warning animate-pulse shrink-0">
                                Run...
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* High-tech Terminal block */}
                  <div
                    className="rounded-lg overflow-hidden border border-white/10"
                    style={{ background: "oklch(0.09 0.006 270)" }}
                  >
                    <div
                      className="flex items-center gap-1.5 px-4 py-2 border-b border-white/5"
                      style={{ background: "oklch(0.07 0.006 270)" }}
                    >
                      <span className="size-2 rounded-full bg-destructive/60" />
                      <span className="size-2 rounded-full bg-warning/60" />
                      <span className="size-2 rounded-full bg-success/60" />
                      <span className="ml-3 font-mono text-[9px] text-white/30 uppercase tracking-[0.2em] font-medium">
                        opspilot — correlation logs
                      </span>
                    </div>
                    <div
                      ref={termRef}
                      className="h-64 overflow-y-auto p-4 font-mono text-[10px] leading-relaxed space-y-1 select-text"
                    >
                      {termLog.map((line, idx) => (
                        <div
                          key={idx}
                          className={
                            line.startsWith("✓")
                              ? "text-green-400"
                              : line.startsWith("✗")
                                ? "text-red-400 font-bold"
                                : line.startsWith("⚠")
                                  ? "text-yellow-400"
                                  : line.startsWith("  ↑")
                                    ? "text-primary/70"
                                    : line.startsWith("  [")
                                      ? "text-cyan-400/80"
                                      : line.startsWith("$")
                                        ? "text-white/60"
                                        : "text-white/30"
                          }
                        >
                          {line}
                        </div>
                      ))}
                      <span className="inline-block w-1.5 h-3 bg-white/50 align-middle animate-pulse ml-0.5" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ─── ERROR VIEW ───────────────────────────────────────────────────── */}
        {phase === "error" && (
          <section className="max-w-xl mx-auto text-center py-16">
            <div className="text-5xl mb-4">⚠</div>
            <h2 className="text-xl font-semibold mb-2">Pipeline error</h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{error}</p>
            <p className="text-xs text-muted-foreground mb-8">
              Verify that the backend server is active:{" "}
              <code className="bg-surface px-2 py-1 rounded text-primary">
                python -m uvicorn main:app
              </code>
            </p>
            <button
              type="button"
              onClick={reset}
              className="rounded-md bg-primary text-primary-foreground font-semibold px-6 py-2.5 text-xs uppercase tracking-wider hover:bg-primary/90 transition-colors"
            >
              ↺ Try Again
            </button>
          </section>
        )}

        {/* ─── RESULTS VIEW (DONE) ──────────────────────────────────────────── */}
        {phase === "done" && graph && primaryConclusion && (
          <div className="space-y-10">
            {/* Inline Print Stylesheet */}
            <style
              dangerouslySetInnerHTML={{
                __html: `
              @media print {
                body {
                  background: white !important;
                  color: black !important;
                }
                nav, header, .print-hide, button, aside, .dot-grid, svg, .playback-container, .nav-header {
                  display: none !important;
                }
                main {
                  padding-top: 0 !important;
                  padding-bottom: 0 !important;
                  margin: 0 !important;
                  max-width: 100% !important;
                  width: 100% !important;
                }
                .print-report {
                  display: block !important;
                }
              }
            `,
              }}
            />

            {/* Case metadata Header */}
            <div className="flex flex-wrap items-center gap-4 border-b border-border/40 pb-5 print-hide">
              <StatusPill
                status={
                  graph.nodes.find((n) => n.type === "risk")?.data?.risk_label === "high"
                    ? "review_needed"
                    : "review_needed"
                }
              />
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                {graph.metadata.incident_id.slice(0, 12).toUpperCase()}
              </span>
              {graph.metadata.input_hash && (
                <span className="font-mono text-xs text-muted-foreground">
                  · HASH {shortHash(graph.metadata.input_hash)}
                </span>
              )}

              <div className="ml-auto flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="text-xs font-mono uppercase tracking-wider text-primary border border-primary/50 hover:bg-primary/10 rounded px-3.5 py-1.5 transition-all flex items-center gap-1.5 shadow-[0_0_15px_-3px_oklch(0.62_0.18_258_/_0.2)] cursor-pointer"
                >
                  📄 Export Report
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors border border-border/50 rounded px-3 py-1.5 hover:border-border cursor-pointer"
                >
                  ↺ Restart Demo
                </button>
              </div>
            </div>

            {/* Case Title */}
            <div className="print-hide">
              <h1 className="text-2xl md:text-3xl font-medium tracking-tight text-foreground font-sans">
                {graph.nodes.find((n) => n.type === "risk")?.description?.includes("82") ||
                graph.metadata.incident_id === "demo-incident-001"
                  ? "Shipment SHP-10488 shortage & damage claim correlation"
                  : `Incident ${graph.metadata.incident_id.slice(0, 12)} — reconstructed claims`}
              </h1>

              {/* Tech Specs Transparency Bar */}
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground bg-surface/30 ring-1 ring-border/30 rounded-md px-3.5 py-2">
                <span>
                  Model: <span className="text-foreground/80 font-bold">Gemini 1.5 Flash</span>
                </span>
                <span>
                  Latency:{" "}
                  <span className="text-foreground/80 font-bold">
                    {(
                      Object.values(pipelineEvents).reduce(
                        (acc, ev) => acc + (ev.duration ?? 0),
                        0,
                      ) / 1000
                    ).toFixed(2)}
                    s
                  </span>
                </span>
                <span>
                  Confidence:{" "}
                  <span className="text-success font-bold">
                    {Math.round(
                      (graph.nodes.find((n) => n.type === "risk")?.confidence ?? 0.94) * 100,
                    )}
                    %
                  </span>
                </span>
                <span>
                  Integrity Hash:{" "}
                  <span className="text-foreground/80">{graph.metadata.input_hash || "demo"}</span>
                </span>
                <span className="ml-auto text-[10px] text-muted-foreground/60">
                  {graph.metadata.created_at
                    ? new Date(graph.metadata.created_at).toISOString().slice(11, 19)
                    : "14:03"}{" "}
                  UTC
                </span>
              </div>
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1 rounded-lg bg-surface ring-1 ring-border/50 p-1 w-fit print-hide">
              {(["case", "entities"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors uppercase tracking-wider cursor-pointer ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t === "case" ? "Forensic Summary" : "Raw Extracted Evidence"}
                </button>
              ))}
            </div>

            {/* Tab: CASE SUMMARY */}
            {tab === "case" &&
              (() => {
                // Helper to click link
                const findAndSelectNodeByText = (text: string) => {
                  const lower = text.toLowerCase();
                  // 1. Check if contains shipment ID
                  const shpNode = graph.nodes.find(
                    (n) =>
                      n.type === "entity" &&
                      n.subtype === "shipment_id" &&
                      lower.includes(n.label.toLowerCase()),
                  );
                  if (shpNode) {
                    setSelectedNodeId(shpNode.id);
                    return;
                  }
                  // 2. Check if invoice number
                  const invNode = graph.nodes.find(
                    (n) =>
                      n.type === "entity" &&
                      n.subtype === "shipment_id" &&
                      n.label.startsWith("INV-") &&
                      lower.includes(n.label.toLowerCase()),
                  );
                  if (invNode) {
                    setSelectedNodeId(invNode.id);
                    return;
                  }
                  // 3. Check for specific keywords
                  if (
                    lower.includes("shortage") ||
                    lower.includes("units") ||
                    lower.includes("missing")
                  ) {
                    const shortageNode = graph.nodes.find(
                      (n) =>
                        n.type === "anomaly" ||
                        n.label.toLowerCase().includes("shortage") ||
                        n.label.toLowerCase().includes("missing"),
                    );
                    if (shortageNode) {
                      setSelectedNodeId(shortageNode.id);
                      return;
                    }
                  }
                  if (
                    lower.includes("crushed") ||
                    lower.includes("corner") ||
                    lower.includes("dent")
                  ) {
                    const crushNode = graph.nodes.find(
                      (n) =>
                        n.label.toLowerCase().includes("crushed") ||
                        n.label.toLowerCase().includes("corner"),
                    );
                    if (crushNode) {
                      setSelectedNodeId(crushNode.id);
                      return;
                    }
                  }
                  if (
                    lower.includes("water") ||
                    lower.includes("wet") ||
                    lower.includes("stains")
                  ) {
                    const waterNode = graph.nodes.find(
                      (n) =>
                        n.label.toLowerCase().includes("water") ||
                        n.label.toLowerCase().includes("wet"),
                    );
                    if (waterNode) {
                      setSelectedNodeId(waterNode.id);
                      return;
                    }
                  }
                  if (
                    lower.includes("photo") ||
                    lower.includes("image") ||
                    lower.includes("picture")
                  ) {
                    const photoNode = graph.nodes.find((n) => n.subtype === "damage_image");
                    if (photoNode) {
                      setSelectedNodeId(photoNode.id);
                      return;
                    }
                  }
                  if (lower.includes("complaint") || lower.includes("email")) {
                    const emailNode = graph.nodes.find((n) => n.subtype === "complaint_email");
                    if (emailNode) {
                      setSelectedNodeId(emailNode.id);
                      return;
                    }
                  }
                  if (lower.includes("invoice")) {
                    const invoiceNode = graph.nodes.find((n) => n.subtype === "invoice_pdf");
                    if (invoiceNode) {
                      setSelectedNodeId(invoiceNode.id);
                      return;
                    }
                  }
                };

                // Risk assessment factors
                const riskNode = graph.nodes.find((n) => n.type === "risk");
                const d = riskNode?.data || {};
                const evStrength = d.evidence_strength ?? 0.92;
                const dmgSev = d.damage_severity ?? 0.88;
                const finExp = d.financial_exposure ?? 0.95;
                const urg = d.urgency ?? 1.0;
                const penalty = d.inconsistency_penalty ?? 0.0;

                const riskAssessmentFactors = [
                  {
                    name: "Evidence Strength",
                    points: evStrength * 35,
                    max: 35,
                    icon: "📊",
                    desc: "Corroboration ratio across docs",
                  },
                  {
                    name: "Damage Severity",
                    points: dmgSev * 25,
                    max: 25,
                    icon: "📦",
                    desc: "Physical and packaging damage levels",
                  },
                  {
                    name: "Financial Exposure",
                    points: finExp * 20,
                    max: 20,
                    icon: "💰",
                    desc: "Total exposure normalized to $50k",
                  },
                  {
                    name: "Urgency Factor",
                    points: urg * 10,
                    max: 10,
                    icon: "🚨",
                    desc: "Presence of complaints or escalations",
                  },
                  {
                    name: "Contradiction Penalty",
                    points: penalty * 10,
                    max: 10,
                    icon: "⚠️",
                    desc: "Penalty for conflicting statements",
                    isPenalty: true,
                  },
                ];

                // Matches
                const corrEdge = graph.edges.find((e) => e.confidence_breakdown?.match_details);
                const matchLedger = corrEdge?.confidence_breakdown?.match_details || {
                  shipment_match: {
                    invoice_val: "SHP-10488",
                    complaint_val: "SHP-10488",
                    status: "Matched",
                    confidence: 1.0,
                  },
                  temporal_match: {
                    invoice_val: "2026-06-01",
                    complaint_val: "2026-06-03",
                    status: "Valid Timeline",
                    confidence: 0.96,
                  },
                  damage_match: {
                    complaint_val: "crushed corner, water damage",
                    vision_val: "crushed corner, water stains",
                    status: "Matched",
                    confidence: 0.94,
                  },
                };

                return (
                  <div className="space-y-10 animate-fade-in print-hide">
                    {/* Dashboard Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">
                      {/* Left Column: Forensic Investigations */}
                      <div className="space-y-8 min-w-0">
                        {/* Operational Pipeline Flow Diagram */}
                        <div className="rounded-xl bg-surface/50 ring-1 ring-border/30 p-4 font-sans flex items-center justify-between text-[11px] text-muted-foreground overflow-x-auto gap-4 scrollbar-none">
                          <div className="flex items-center gap-2 shrink-0 font-medium text-foreground">
                            <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20 text-[9px] font-bold">
                              1
                            </span>
                            <span>Evidence</span>
                          </div>
                          <span className="text-muted-foreground/30 shrink-0">➔</span>
                          <div className="flex items-center gap-2 shrink-0 font-medium text-foreground">
                            <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20 text-[9px] font-bold">
                              2
                            </span>
                            <span>Analysis</span>
                          </div>
                          <span className="text-muted-foreground/30 shrink-0">➔</span>
                          <div className="flex items-center gap-2 shrink-0 font-medium text-foreground">
                            <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20 text-[9px] font-bold">
                              3
                            </span>
                            <span>Competing Hypotheses</span>
                          </div>
                          <span className="text-muted-foreground/30 shrink-0">➔</span>
                          <div className="flex items-center gap-2 shrink-0 font-bold text-primary animate-pulse">
                            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-bold">
                              4
                            </span>
                            <span>Best Explanation</span>
                          </div>
                          <span className="text-primary/30 shrink-0 font-bold">➔</span>
                          <div className="flex items-center gap-2 shrink-0 font-medium text-foreground">
                            <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20 text-[9px] font-bold">
                              5
                            </span>
                            <span>Report</span>
                          </div>
                        </div>

                        {/* Premium Executive Brief (Investigation Narrative) */}
                        <section className="rounded-xl bg-surface ring-1 ring-border/50 p-6 relative overflow-hidden">
                          <div className="absolute top-0 right-0 size-32 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
                          <SectionLabel>Incident Executive Brief</SectionLabel>

                          <div className="mt-4 border-b border-border/40 pb-5">
                            <h2 className="text-xl font-medium tracking-tight text-foreground font-sans">
                              Executive Summary
                            </h2>
                            <p className="mt-2 text-sm text-foreground/90 leading-relaxed font-sans">
                              {primaryConclusion.executive_summary || primaryConclusion.summary}
                            </p>
                          </div>

                          {primaryConclusion.investigation_narrative && (
                            <div className="mt-5 space-y-2">
                              <Mono>Investigation Narrative</Mono>
                              <p className="text-xs text-muted-foreground leading-relaxed font-sans whitespace-pre-line bg-background/30 rounded-lg p-4 ring-1 ring-border/30">
                                {primaryConclusion.investigation_narrative}
                              </p>
                            </div>
                          )}
                        </section>

                        {/* Timeline Reconstruction */}
                        {primaryConclusion.timeline_reconstruction &&
                          primaryConclusion.timeline_reconstruction.length > 0 && (
                            <section className="rounded-xl bg-surface ring-1 ring-border/50 p-6">
                              <SectionLabel>Timeline Reconstruction</SectionLabel>
                              <p className="text-xs text-muted-foreground mt-1.5 mb-5 font-sans">
                                Chronological trace of events reconstructed from multi-modal
                                evidence. Click a card to inspect the source file.
                              </p>
                              <div className="relative pl-6 border-l border-border/40 space-y-6">
                                {primaryConclusion.timeline_reconstruction.map(
                                  (item: any, idx: number) => (
                                    <div
                                      key={idx}
                                      onClick={() => findAndSelectNodeByText(item.evidence_source)}
                                      className="group relative bg-background/40 hover:bg-surface-2 ring-1 ring-border/30 hover:ring-primary/40 rounded-lg p-4 cursor-pointer transition-all"
                                    >
                                      {/* Step marker */}
                                      <span className="absolute -left-[31px] top-4 flex size-4 items-center justify-center rounded-full bg-background border border-border group-hover:border-primary/50 group-hover:text-primary transition-all">
                                        <span className="size-1.5 rounded-full bg-primary" />
                                      </span>
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="font-mono text-[10px] text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded">
                                          {item.timestamp}
                                        </span>
                                        <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-widest group-hover:text-primary transition-colors">
                                          Source: {item.evidence_source}
                                        </span>
                                      </div>
                                      <p className="mt-2 text-[13px] text-foreground/90 font-medium font-sans">
                                        {item.event}
                                      </p>
                                    </div>
                                  ),
                                )}
                              </div>
                            </section>
                          )}

                        {/* Consistency & Contradiction Analysis */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Evidence Consistency */}
                          <section className="rounded-xl bg-surface ring-1 ring-border/50 p-6 flex flex-col justify-between">
                            <div>
                              <SectionLabel>Evidence Consistency</SectionLabel>
                              <p className="text-xs text-muted-foreground mt-1.5 mb-4 font-sans">
                                Corroborated claims across parsed documents.
                              </p>
                              <div className="space-y-3">
                                {primaryConclusion.evidence_consistency?.map(
                                  (ec: any, idx: number) => (
                                    <div
                                      key={idx}
                                      className="rounded-lg bg-background/20 ring-1 ring-border/25 p-3 text-xs"
                                    >
                                      <div className="flex items-center gap-2 font-sans mb-1">
                                        <span className="text-success text-sm">✓</span>
                                        <span className="font-bold text-foreground">{ec.item}</span>
                                        <span className="ml-auto font-mono text-[10px] text-success bg-success/10 px-1.5 py-0.5 rounded">
                                          {Math.round(ec.confidence * 100)}%
                                        </span>
                                      </div>
                                      <p className="text-muted-foreground text-[11px] font-sans leading-relaxed">
                                        {ec.details}
                                      </p>
                                    </div>
                                  ),
                                )}
                                {(!primaryConclusion.evidence_consistency ||
                                  primaryConclusion.evidence_consistency.length === 0) && (
                                  <p className="text-xs text-muted-foreground italic font-sans">
                                    No consistency data found.
                                  </p>
                                )}
                              </div>
                            </div>
                          </section>

                          {/* Contradiction Analysis */}
                          <section className="rounded-xl bg-surface ring-1 ring-border/50 p-6 flex flex-col justify-between">
                            <div>
                              <SectionLabel>Contradiction Analysis</SectionLabel>
                              <p className="text-xs text-muted-foreground mt-1.5 mb-4 font-sans">
                                Discrepancy and conflict adjudication.
                              </p>
                              <div className="space-y-3">
                                {primaryConclusion.contradiction_analysis?.map(
                                  (ca: any, idx: number) => (
                                    <div
                                      key={idx}
                                      className="rounded-lg bg-background/20 ring-1 ring-border/25 p-3 text-xs border-l-2 border-l-warning"
                                    >
                                      <div className="flex items-center gap-2 font-sans mb-1">
                                        <span className="text-warning text-sm">⚠</span>
                                        <span className="font-bold text-foreground">
                                          Discrepancy
                                        </span>
                                      </div>
                                      <p className="text-foreground/90 text-[11px] font-sans font-medium mb-1.5">
                                        {ca.conflict}
                                      </p>
                                      <div className="text-[10px] text-muted-foreground space-y-0.5 font-mono">
                                        <div>A: {ca.source_a}</div>
                                        <div>B: {ca.source_b}</div>
                                      </div>
                                      <div className="mt-2 text-[11px] text-primary bg-primary/5 rounded p-2 border border-primary/20 font-sans leading-relaxed">
                                        <span className="font-bold font-mono text-[9px] uppercase tracking-wider block mb-0.5">
                                          Adjudication Resolution:
                                        </span>
                                        {ca.resolution}
                                      </div>
                                    </div>
                                  ),
                                )}
                                {(!primaryConclusion.contradiction_analysis ||
                                  primaryConclusion.contradiction_analysis.length === 0) && (
                                  <div className="flex items-center gap-2 text-xs text-success bg-success/10 border border-success/20 rounded-lg p-3 font-sans">
                                    <span>✓</span>
                                    <span>No conflicting or contradictory evidence detected.</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </section>
                        </div>

                        {/* Financial Impact */}
                        {primaryConclusion.financial_impact && (
                          <section className="rounded-xl bg-surface ring-1 ring-border/50 p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 size-32 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
                            <SectionLabel>Financial Exposure Analysis</SectionLabel>
                            <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 bg-background/20 ring-1 ring-border/30 rounded-xl p-5">
                              <div className="space-y-1">
                                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                                  Estimated Loss ({primaryConclusion.financial_impact.currency})
                                </div>
                                <div className="text-3xl font-bold font-mono text-foreground tracking-tight">
                                  {new Intl.NumberFormat("en-US", {
                                    style: "currency",
                                    currency: primaryConclusion.financial_impact.currency || "USD",
                                  }).format(primaryConclusion.financial_impact.estimated_loss)}
                                </div>
                              </div>
                              <div className="flex-1 text-xs text-foreground/80 leading-relaxed font-sans bg-surface/50 rounded-lg p-3.5 border border-border/40">
                                <span className="font-mono text-[9px] text-primary uppercase tracking-wider block mb-1 font-bold">
                                  Calculation Breakdown:
                                </span>
                                {primaryConclusion.financial_impact.breakdown}
                              </div>
                            </div>
                          </section>
                        )}

                        {/* Root Cause Hypotheses */}
                        {primaryConclusion.root_cause_hypotheses &&
                          primaryConclusion.root_cause_hypotheses.length > 0 && (
                            <section className="rounded-xl bg-surface ring-1 ring-border/50 p-6">
                              <SectionLabel>Root Cause Hypotheses</SectionLabel>
                              <p className="text-xs text-muted-foreground mt-1.5 mb-4 font-sans">
                                Ranked root cause scenarios compiled with confidence indexes.
                              </p>
                              {primaryConclusion.best_explanation && (
                                <div className="mb-6 rounded-xl bg-primary/5 border border-primary/20 p-5 font-sans relative overflow-hidden">
                                  <div className="absolute top-2 right-3 text-primary/20 text-3xl pointer-events-none select-none font-serif">
                                    ⚖️
                                  </div>
                                  <h4 className="font-bold text-xs uppercase tracking-wider text-primary mb-2 flex items-center gap-1.5">
                                    <span>Analysis of Competing Hypotheses (ACH)</span>
                                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[9px] font-mono lowercase normal-case tracking-normal">
                                      Best Explanation
                                    </span>
                                  </h4>
                                  <p className="text-xs text-foreground/90 leading-relaxed font-sans font-medium">
                                    {primaryConclusion.best_explanation}
                                  </p>
                                </div>
                              )}
                              <div className="space-y-4">
                                {primaryConclusion.root_cause_hypotheses.map(
                                  (h: any, idx: number) => (
                                    <div
                                      key={idx}
                                      className="rounded-xl bg-background/30 ring-1 ring-border/30 p-5 hover:bg-surface-2 transition-colors"
                                    >
                                      <div className="flex items-start justify-between gap-4 border-b border-border/30 pb-3 flex-wrap">
                                        <div className="min-w-0 flex-1">
                                          <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                                            Hypothesis {idx + 1}
                                          </span>
                                          <h4 className="mt-1 font-bold text-sm text-foreground font-sans leading-snug">
                                            {h.hypothesis}
                                          </h4>
                                        </div>
                                        <ConfidenceLabel
                                          confidence={Math.round(h.confidence * 100)}
                                          label={strengthForConfidence(
                                            Math.round(h.confidence * 100),
                                          )}
                                          compact
                                        />
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-[11px] font-sans">
                                        <div className="space-y-1.5">
                                          <div className="font-mono text-[9px] uppercase tracking-wider text-success font-semibold">
                                            Supporting Indicators
                                          </div>
                                          <ul className="list-disc pl-4 space-y-1 text-muted-foreground leading-relaxed">
                                            {h.supporting_evidence?.map(
                                              (item: string, i: number) => (
                                                <li
                                                  key={i}
                                                  className="hover:text-foreground transition-colors cursor-pointer"
                                                  onClick={() => findAndSelectNodeByText(item)}
                                                >
                                                  {item}
                                                </li>
                                              ),
                                            )}
                                          </ul>
                                        </div>
                                        <div className="space-y-1.5">
                                          <div className="font-mono text-[9px] uppercase tracking-wider text-destructive font-semibold">
                                            Negating Indicators
                                          </div>
                                          <ul className="list-disc pl-4 space-y-1 text-muted-foreground leading-relaxed">
                                            {h.negating_evidence?.map((item: string, i: number) => (
                                              <li
                                                key={i}
                                                className="hover:text-foreground transition-colors cursor-pointer"
                                                onClick={() => findAndSelectNodeByText(item)}
                                              >
                                                {item}
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      </div>
                                    </div>
                                  ),
                                )}
                              </div>
                            </section>
                          )}

                        {/* Prioritized Recommended Actions */}
                        {primaryConclusion.prioritized_actions &&
                          primaryConclusion.prioritized_actions.length > 0 && (
                            <section className="rounded-xl bg-surface ring-1 ring-border/50 p-6">
                              <SectionLabel>Prioritized Actions</SectionLabel>
                              <p className="text-xs text-muted-foreground mt-1.5 mb-4 font-sans">
                                Actionable outcomes sorted by response priority and cited evidence.
                              </p>
                              <div className="space-y-3">
                                {primaryConclusion.prioritized_actions.map(
                                  (act: any, idx: number) => {
                                    const isHigh = act.priority === "high";
                                    const isMed = act.priority === "medium";
                                    const priorityColor = isHigh
                                      ? "text-destructive border-destructive/30 bg-destructive/5"
                                      : isMed
                                        ? "text-warning border-warning/30 bg-warning/5"
                                        : "text-primary border-primary/30 bg-primary/5";

                                    const refs =
                                      typeof act.evidence_ref === "string"
                                        ? act.evidence_ref
                                            .split(",")
                                            .map((x: string) => x.trim())
                                            .filter(Boolean)
                                        : Array.isArray(act.evidence_ref)
                                          ? act.evidence_ref
                                          : [];

                                    return (
                                      <div
                                        key={idx}
                                        className={`rounded-lg bg-background/20 ring-1 ring-border/40 p-4 border-l-2 ${isHigh ? "border-l-destructive" : isMed ? "border-l-warning" : "border-l-primary"} flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-surface-2 transition-all`}
                                      >
                                        <div className="space-y-1 font-sans">
                                          <div className="flex items-center gap-2">
                                            <span
                                              className={`font-mono text-[8px] uppercase font-bold tracking-[0.16em] ring-1 px-2 py-0.5 rounded-full ${priorityColor}`}
                                            >
                                              {act.priority} priority
                                            </span>
                                            <div className="font-bold text-sm text-foreground">
                                              {act.action}
                                            </div>
                                          </div>
                                          <div className="text-xs text-muted-foreground leading-relaxed mt-1">
                                            {act.rationale}
                                          </div>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 md:self-center shrink-0 font-mono">
                                          {refs.map((src: string) => (
                                            <button
                                              key={src}
                                              type="button"
                                              onClick={() => findAndSelectNodeByText(src)}
                                              className="rounded bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-all font-mono text-[9px] text-primary uppercase tracking-wider px-2 py-0.5 cursor-pointer"
                                              title="Click to highlight this source evidence"
                                            >
                                              {src
                                                .replace(" PDF", "")
                                                .replace(" Email", "")
                                                .replace(" Photo", "photo")}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  },
                                )}
                              </div>
                            </section>
                          )}
                      </div>

                      {/* Right Column: Risk Assessment (Sticky) */}
                      <aside className="space-y-8 lg:sticky lg:top-20 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-none">
                        {/* Risk Assessment Factor Breakdown */}
                        <section className="rounded-xl bg-surface ring-1 ring-border/50 p-6 relative overflow-hidden">
                          <div className="absolute top-0 right-0 size-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
                          <SectionLabel>Risk Assessment</SectionLabel>

                          {/* Risk score dial */}
                          <div className="mt-5 flex flex-col items-center justify-center border-b border-border/30 pb-5">
                            <div className="relative size-28 flex items-center justify-center">
                              {/* Dial track */}
                              <svg
                                className="absolute inset-0 size-full transform -rotate-90"
                                viewBox="0 0 100 100"
                              >
                                <circle
                                  cx="50"
                                  cy="50"
                                  r="42"
                                  stroke="oklch(0.27 0.012 270)"
                                  strokeWidth="7"
                                  fill="transparent"
                                />
                                <circle
                                  cx="50"
                                  cy="50"
                                  r="42"
                                  stroke={
                                    primaryConclusion.risk_label === "high"
                                      ? "oklch(0.55 0.2 18)"
                                      : "oklch(0.74 0.15 65)"
                                  }
                                  strokeWidth="7"
                                  fill="transparent"
                                  strokeDasharray={2 * Math.PI * 42}
                                  strokeDashoffset={
                                    2 * Math.PI * 42 * (1 - primaryConclusion.risk_score / 100)
                                  }
                                  strokeLinecap="round"
                                />
                              </svg>
                              <div className="text-center z-10">
                                <span className="font-mono text-3xl font-extrabold tracking-tight text-foreground">
                                  {Math.round(primaryConclusion.risk_score)}
                                </span>
                                <span className="font-mono text-xs text-muted-foreground">
                                  /100
                                </span>
                              </div>
                            </div>
                            {(() => {
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
                            })()}
                          </div>

                          {/* Breakdown factors list */}
                          <div className="mt-5 space-y-3.5">
                            <Mono>Risk Factors Contribution</Mono>
                            <div className="space-y-3">
                              {riskAssessmentFactors.map((f, idx) => (
                                <div key={idx} className="space-y-1.5">
                                  <div className="flex justify-between items-center text-[11px]">
                                    <div className="flex items-center gap-1.5 text-foreground/80 font-medium font-sans">
                                      <span>{f.icon}</span>
                                      <span>{f.name}</span>
                                    </div>
                                    <span className="font-mono text-foreground font-semibold">
                                      {f.isPenalty ? "-" : "+"}
                                      {f.points.toFixed(1)}{" "}
                                      <span className="text-muted-foreground/60">/ {f.max}</span>
                                    </span>
                                  </div>
                                  <div className="h-1 w-full bg-background rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${f.isPenalty ? "bg-destructive" : "bg-primary"}`}
                                      style={{ width: `${(f.points / f.max) * 100}%` }}
                                    />
                                  </div>
                                  <p className="text-[9px] text-muted-foreground/80 leading-normal font-sans">
                                    {f.desc}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </section>

                        {/* Match Ledger */}
                        <section className="rounded-xl bg-surface ring-1 ring-border/50 p-6">
                          <SectionLabel>Evidence Match Ledger</SectionLabel>
                          <div className="mt-3 space-y-2.5">
                            {Object.entries(matchLedger).map(([key, match]: [string, any]) => (
                              <div
                                key={key}
                                className="rounded-lg bg-background/30 ring-1 ring-border/25 p-3 text-xs"
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="font-mono text-[9px] uppercase tracking-wider text-primary font-bold">
                                    {key.replace(/_/g, " ")}
                                  </span>
                                  <span
                                    className={`font-mono text-[9px] px-1.5 py-0.5 rounded ${match.status === "Matched" ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}
                                  >
                                    {Math.round(match.confidence * 100)}%
                                  </span>
                                </div>
                                <div className="text-[10px] text-muted-foreground space-y-0.5 font-mono">
                                  {match.invoice_val && (
                                    <div>
                                      Invoice:{" "}
                                      <span className="text-foreground/80">
                                        {match.invoice_val}
                                      </span>
                                    </div>
                                  )}
                                  {match.complaint_val && (
                                    <div>
                                      Complaint:{" "}
                                      <span className="text-foreground/80">
                                        {match.complaint_val}
                                      </span>
                                    </div>
                                  )}
                                  {match.vision_val && (
                                    <div>
                                      Vision:{" "}
                                      <span className="text-foreground/80">{match.vision_val}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                      </aside>
                    </div>

                    {/* ═══ FULL-WIDTH: Evidence Graph ═══════════════════════════════════ */}
                    <section className="mt-10 animate-fade-in">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <SectionLabel>Interactive Evidence Graph</SectionLabel>
                          <p className="text-xs text-muted-foreground font-sans mt-1">
                            Click any node to inspect provenance. Blue pulsing lines indicate
                            confirmed correlations.
                          </p>
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                          {graph.nodes.length} nodes · {graph.edges.length} edges
                        </span>
                      </div>
                      <EvidenceGraphView
                        nodes={graph.nodes}
                        edges={graph.edges}
                        selectedId={selectedNodeId}
                        onSelect={setSelectedNodeId}
                      />
                    </section>

                    {/* ═══ FULL-WIDTH: Playback + Audit Trail side-by-side ═════════════ */}
                    <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
                      {/* Stepper Playback */}
                      {playbackEvents.length > 0 && (
                        <section className="playback-container">
                          <SectionLabel>Investigation Playback</SectionLabel>
                          <div className="mt-3">
                            <Playback events={playbackEvents} />
                          </div>
                        </section>
                      )}

                      {/* Detailed Audit Trail */}
                      <section>
                        <SectionLabel>Audit Trail</SectionLabel>
                        <div className="mt-3 max-h-80 overflow-y-auto rounded-xl ring-1 ring-border/40 divide-y divide-border/40 bg-surface/30">
                          {termLog
                            .filter((l) => l.startsWith("  ["))
                            .map((line, idx) => {
                              const cleanLine = line.replace(/^\s+/, "");
                              const closeIdx = cleanLine.indexOf("]");
                              const stageRaw = cleanLine.substring(1, closeIdx);
                              const msg = cleanLine.substring(closeIdx + 2);
                              return (
                                <div
                                  key={idx}
                                  className="px-3.5 py-3 flex items-baseline gap-3 text-xs hover:bg-background/25 transition-colors"
                                >
                                  <span className="font-mono text-[9px] text-muted-foreground w-12 shrink-0">
                                    #{idx + 1}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-primary truncate block">
                                      {stageRaw.replace(/_/g, " ")}
                                    </span>
                                    <span className="text-foreground/80 text-[11px] leading-relaxed mt-0.5 block font-sans">
                                      {msg}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </section>
                    </div>
                  </div>
                );
              })()}

            {/* Tab: EXTRACTED ENTITIES (RAW EXTRACTED EVIDENCE) */}
            {tab === "entities" && (
              <div className="space-y-8 animate-fade-in print-hide">
                <p className="text-xs text-muted-foreground max-w-md leading-relaxed font-sans">
                  Raw textual and visual evidence parsed from each source document. Click a row to
                  inspect its references.
                </p>

                <div className="grid grid-cols-1 gap-6">
                  {docNodes.map((doc) => {
                    // Filter entities belonging to this document node
                    // either by presence in mentions document_roles, or contains edge source
                    const docEntities = graph.nodes.filter((n) => {
                      if (n.type === "document" || n.type === "risk") return false;
                      const hasDocRole = n.data?.document_roles?.includes(doc.subtype);
                      const hasEdge = graph.edges.some(
                        (e) => e.source === doc.id && e.target === n.id,
                      );
                      return hasDocRole || hasEdge;
                    });

                    return (
                      <div
                        key={doc.id}
                        className="rounded-xl bg-surface ring-1 ring-border/50 overflow-hidden shadow-lg"
                      >
                        {/* Header details */}
                        <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between flex-wrap gap-3 bg-background/20">
                          <div>
                            <span className="inline-block rounded bg-primary/10 text-primary ring-1 ring-primary/30 px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest mb-1.5">
                              {doc.subtype?.replace(/_/g, " ").toUpperCase() ||
                                doc.type.toUpperCase()}
                            </span>
                            <h3 className="font-bold text-sm text-foreground">
                              {doc.label} ·{" "}
                              <span className="font-mono text-xs font-normal text-muted-foreground">
                                {doc.data?.filename || "source_file"}
                              </span>
                            </h3>
                          </div>
                          <div className="text-right text-[10px] font-mono text-muted-foreground leading-normal">
                            <div>
                              PARSER:{" "}
                              <span className="text-primary font-semibold">{doc.data?.parser}</span>
                            </div>
                            {doc.data?.page_count && <div>PAGES: {doc.data?.page_count}</div>}
                          </div>
                        </div>

                        {/* Content summary paragraph */}
                        <div className="px-5 py-3.5 bg-surface-2/40 text-xs text-foreground/80 border-b border-border/30 font-sans">
                          <span className="font-mono text-[9px] text-muted-foreground uppercase mr-1">
                            Content Summary:
                          </span>
                          {doc.description ||
                            "Source document ingested and analyzed in the pipeline."}
                        </div>

                        {/* Entities list */}
                        {docEntities.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs font-sans">
                              <thead>
                                <tr className="border-b border-border/30 bg-background/30 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                                  <th className="px-5 py-2.5 w-1/4">Entity Value</th>
                                  <th className="px-5 py-2.5 w-1/6">Subtype</th>
                                  <th className="px-5 py-2.5 w-1/12 text-right">Confidence</th>
                                  <th className="px-5 py-2.5">Supporting Quote/Trace Span</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/20">
                                {docEntities.map((e, idx) => {
                                  // Look up source ref for this document
                                  const quotes =
                                    graph.source_refs?.filter(
                                      (s) =>
                                        e.source_ref_ids?.includes(s.id) &&
                                        s.document_id === doc.id,
                                    ) || [];

                                  return (
                                    <tr
                                      key={idx}
                                      onClick={() => setSelectedNodeId(e.id)}
                                      className={`hover:bg-primary/5 transition-colors cursor-pointer ${selectedNodeId === e.id ? "bg-primary/5 font-semibold" : ""}`}
                                    >
                                      <td className="px-5 py-3 text-[13px] text-foreground font-semibold">
                                        {e.label}
                                      </td>
                                      <td className="px-5 py-3">
                                        <span className="font-mono text-[9px] text-primary uppercase tracking-[0.08em] bg-primary/5 ring-1 ring-primary/20 px-1.5 py-0.5 rounded">
                                          {e.subtype || e.type}
                                        </span>
                                      </td>
                                      <td className="px-5 py-3 text-right">
                                        <span
                                          className={`font-mono font-bold ${e.confidence >= 0.9 ? "text-success" : e.confidence >= 0.75 ? "text-primary" : "text-warning"}`}
                                        >
                                          {Math.round(e.confidence * 100)}%
                                        </span>
                                      </td>
                                      <td className="px-5 py-3 text-xs italic text-foreground/70 leading-relaxed font-serif">
                                        {quotes.length > 0 ? (
                                          quotes.map((q, i) => (
                                            <span
                                              key={i}
                                              className="block border-l-2 border-primary/30 pl-2 mb-1 last:mb-0"
                                            >
                                              &ldquo;{q.text}&rdquo;
                                            </span>
                                          ))
                                        ) : (
                                          <span className="text-muted-foreground/60 text-[11px] font-sans italic">
                                            Extracted directly from record properties
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="p-5 text-center text-xs text-muted-foreground italic font-sans">
                            No structured entities or observations extracted from this file.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ─── PRINTABLE REPORT LAYOUT (HIDDEN ON SCREEN) ─────────────────────────────────── */}
      {phase === "done" && graph && primaryConclusion && (
        <div className="hidden print-report font-sans text-black p-8 space-y-8 select-text">
          <div className="border-b-2 border-black pb-4 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold tracking-tight uppercase text-black">
                OpsPilot AI Incident Forensic Report
              </h1>
              <p className="text-[10px] text-gray-500 font-mono">
                AUTOMATED EVIDENCE CORRELATION & AUDIT PATHWAY
              </p>
            </div>
            <div className="text-right text-xs font-mono text-black">
              <div>INCIDENT: {graph.metadata.incident_id.toUpperCase()}</div>
              <div>
                DATE:{" "}
                {graph.metadata.created_at
                  ? new Date(graph.metadata.created_at).toUTCString()
                  : new Date().toUTCString()}
              </div>
              <div>INTEGRITY HASH: {graph.metadata.input_hash || "N/A"}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 text-xs bg-gray-50 p-4 border border-gray-200 rounded text-black">
            <div>
              <h3 className="font-bold uppercase mb-2">Audit Metadata</h3>
              <table className="w-full text-left">
                <tbody>
                  <tr>
                    <td className="font-medium pr-4">Incident ID</td>
                    <td className="font-mono">{graph.metadata.incident_id}</td>
                  </tr>
                  <tr>
                    <td className="font-medium pr-4">Job ID</td>
                    <td className="font-mono">{graph.metadata.job_id}</td>
                  </tr>
                  <tr>
                    <td className="font-medium pr-4">Pipeline Status</td>
                    <td className="uppercase font-mono">Completed</td>
                  </tr>
                  <tr>
                    <td className="font-medium pr-4">Engine Versions</td>
                    <td className="font-mono">correlator v1.0.0, graph_builder v1.0.0</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4 text-black">
            <h2 className="text-lg font-bold border-b border-gray-300 pb-1 uppercase">
              1. Incident Executive Brief
            </h2>
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase text-gray-700">Executive Summary</h3>
              <p className="text-sm leading-relaxed">
                {primaryConclusion.executive_summary || primaryConclusion.summary}
              </p>
            </div>
            {primaryConclusion.investigation_narrative && (
              <div className="space-y-2 mt-4">
                <h3 className="text-xs font-bold uppercase text-gray-700">
                  Detailed Investigation Narrative
                </h3>
                <p className="text-xs leading-relaxed whitespace-pre-line text-gray-800 bg-gray-50 border border-gray-250 p-4 rounded">
                  {primaryConclusion.investigation_narrative}
                </p>
              </div>
            )}
          </div>

          {primaryConclusion.timeline_reconstruction &&
            primaryConclusion.timeline_reconstruction.length > 0 && (
              <div className="space-y-4 text-black">
                <h2 className="text-lg font-bold border-b border-gray-300 pb-1 uppercase">
                  2. Timeline Reconstruction
                </h2>
                <div className="border border-gray-200 rounded overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-100 uppercase font-bold">
                      <tr>
                        <th className="p-2 w-28">Timestamp</th>
                        <th className="p-2">Reconstructed Event</th>
                        <th className="p-2 w-44">Evidence Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {primaryConclusion.timeline_reconstruction.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="p-2 font-mono font-semibold text-blue-900">
                            {item.timestamp}
                          </td>
                          <td className="p-2 text-gray-800">{item.event}</td>
                          <td className="p-2 text-gray-600 font-mono">{item.evidence_source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          <div className="space-y-4 text-black">
            <h2 className="text-lg font-bold border-b border-gray-300 pb-1 uppercase">
              3. Evidence Consistency & Contradiction
            </h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-xs font-bold uppercase text-gray-700 mb-2">
                  Evidence Consistency
                </h3>
                <div className="space-y-2">
                  {primaryConclusion.evidence_consistency?.map((ec: any, idx: number) => (
                    <div key={idx} className="border border-gray-200 p-3 rounded bg-gray-50">
                      <div className="flex justify-between font-bold text-xs mb-1 text-green-950">
                        <span>✓ {ec.item}</span>
                        <span className="font-mono">{Math.round(ec.confidence * 100)}%</span>
                      </div>
                      <p className="text-gray-700 text-[11px]">{ec.details}</p>
                    </div>
                  ))}
                  {(!primaryConclusion.evidence_consistency ||
                    primaryConclusion.evidence_consistency.length === 0) && (
                    <p className="text-xs text-gray-500 italic">No consistency data available.</p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase text-gray-700 mb-2">
                  Contradiction Analysis
                </h3>
                <div className="space-y-2">
                  {primaryConclusion.contradiction_analysis?.map((ca: any, idx: number) => (
                    <div key={idx} className="border border-amber-300 p-3 rounded bg-amber-50/50">
                      <div className="font-bold text-xs text-amber-950 mb-1">⚠ {ca.conflict}</div>
                      <div className="text-[10px] text-gray-500 font-mono mb-1">
                        Sources: {ca.source_a} vs {ca.source_b}
                      </div>
                      <p className="text-gray-800 text-[11px] font-medium">
                        Resolution: {ca.resolution}
                      </p>
                    </div>
                  ))}
                  {(!primaryConclusion.contradiction_analysis ||
                    primaryConclusion.contradiction_analysis.length === 0) && (
                    <p className="text-xs text-green-800 bg-green-55 p-3 rounded border border-green-200">
                      No contradictions or mismatches identified.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {primaryConclusion.financial_impact && (
            <div className="space-y-4 text-black">
              <h2 className="text-lg font-bold border-b border-gray-300 pb-1 uppercase">
                4. Financial Exposure Analysis
              </h2>
              <div className="border border-gray-200 p-4 rounded bg-gray-50 flex items-center justify-between gap-6">
                <div>
                  <div className="text-[10px] uppercase font-bold text-gray-500 font-mono">
                    Estimated Financial Exposure
                  </div>
                  <div className="text-2xl font-bold font-mono text-gray-900">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: primaryConclusion.financial_impact.currency || "USD",
                    }).format(primaryConclusion.financial_impact.estimated_loss)}
                  </div>
                </div>
                <div className="flex-1 text-xs text-gray-700 leading-relaxed pl-6 border-l border-gray-300">
                  <span className="font-mono text-[9px] uppercase tracking-wider font-bold block mb-0.5 text-gray-500">
                    Calculation Breakdown:
                  </span>
                  {primaryConclusion.financial_impact.breakdown}
                </div>
              </div>
            </div>
          )}

          {primaryConclusion.best_explanation && (
            <div className="space-y-4 text-black">
              <h2 className="text-lg font-bold border-b border-gray-300 pb-1 uppercase">
                5. Analysis of Competing Hypotheses (ACH)
              </h2>
              <div className="border border-blue-200 p-4 rounded bg-blue-50/20 text-xs leading-relaxed text-black">
                <div className="font-bold uppercase mb-1.5 text-blue-900 text-[10px] tracking-wider font-mono">
                  Best Explanation Decision Summary
                </div>
                <p className="font-medium">{primaryConclusion.best_explanation}</p>
              </div>
            </div>
          )}

          {primaryConclusion.root_cause_hypotheses &&
            primaryConclusion.root_cause_hypotheses.length > 0 && (
              <div className="space-y-4 text-black">
                <h2 className="text-lg font-bold border-b border-gray-300 pb-1 uppercase">
                  {primaryConclusion.best_explanation
                    ? "6. Evaluated Competing Hypotheses"
                    : "5. Root Cause Hypotheses"}
                </h2>
                <div className="space-y-3">
                  {primaryConclusion.root_cause_hypotheses.map((h: any, idx: number) => (
                    <div key={idx} className="border border-gray-200 rounded p-4 bg-gray-50">
                      <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-2">
                        <span className="font-bold text-xs text-gray-900">
                          Hypothesis {idx + 1}: {h.hypothesis}
                        </span>
                        <span className="font-mono font-bold text-xs text-blue-900">
                          Confidence: {Math.round(h.confidence * 100)}%
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-[10px]">
                        <div>
                          <div className="font-mono uppercase font-bold text-green-800 mb-1">
                            Supporting Evidence
                          </div>
                          <ul className="list-disc pl-4 space-y-0.5 text-gray-650">
                            {h.supporting_evidence?.map((item: string, i: number) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <div className="font-mono uppercase font-bold text-red-800 mb-1">
                            Negating Evidence
                          </div>
                          <ul className="list-disc pl-4 space-y-0.5 text-gray-650">
                            {h.negating_evidence?.map((item: string, i: number) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {primaryConclusion.prioritized_actions &&
            primaryConclusion.prioritized_actions.length > 0 && (
              <div className="space-y-4 text-black">
                <h2 className="text-lg font-bold border-b border-gray-300 pb-1 uppercase">
                  {primaryConclusion.best_explanation
                    ? "7. Prioritized Action Plan"
                    : "6. Prioritized Action Plan"}
                </h2>
                <div className="border border-gray-200 rounded overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-100 uppercase font-bold">
                      <tr>
                        <th className="p-2 w-20">Priority</th>
                        <th className="p-2 w-1/3">Action Item</th>
                        <th className="p-2">Rationale</th>
                        <th className="p-2 w-1/4">Cited Evidence References</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {primaryConclusion.prioritized_actions.map((act: any, idx: number) => (
                        <tr
                          key={idx}
                          className={
                            act.priority === "high"
                              ? "bg-red-50/20"
                              : act.priority === "medium"
                                ? "bg-amber-50/20"
                                : ""
                          }
                        >
                          <td className="p-2 font-mono font-bold uppercase text-[10px]">
                            <span
                              className={
                                act.priority === "high"
                                  ? "text-red-700"
                                  : act.priority === "medium"
                                    ? "text-amber-700"
                                    : "text-blue-700"
                              }
                            >
                              {act.priority}
                            </span>
                          </td>
                          <td className="p-2 font-bold text-gray-900">{act.action}</td>
                          <td className="p-2 text-gray-700">{act.rationale}</td>
                          <td className="p-2 text-gray-500 font-mono">
                            {typeof act.evidence_ref === "string"
                              ? act.evidence_ref
                              : Array.isArray(act.evidence_ref)
                                ? act.evidence_ref.join(", ")
                                : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          <div className="space-y-4 page-break-before text-black">
            <h2 className="text-lg font-bold border-b border-gray-300 pb-1 uppercase">
              {primaryConclusion.best_explanation
                ? "8. Document Ingestion & Extracted Evidence"
                : "7. Document Ingestion & Extracted Evidence"}
            </h2>
            <div className="space-y-6">
              {docNodes.map((doc) => {
                const docEntities = graph.nodes.filter((n) => {
                  if (n.type === "document" || n.type === "risk") return false;
                  return (
                    n.data?.document_roles?.includes(doc.subtype) ||
                    graph.edges.some((e) => e.source === doc.id && e.target === n.id)
                  );
                });

                return (
                  <div
                    key={doc.id}
                    className="border border-gray-200 rounded overflow-hidden p-4 space-y-3"
                  >
                    <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                      <span className="font-bold text-sm text-black">
                        {doc.label} ({doc.data?.filename})
                      </span>
                      <span className="text-xs font-mono text-gray-500">
                        PARSER: {doc.data?.parser}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">{doc.description}</p>
                    {docEntities.length > 0 ? (
                      <table className="w-full text-[10px] text-left mt-2">
                        <thead>
                          <tr className="bg-gray-50 text-gray-500 uppercase font-bold">
                            <th className="p-1">Value</th>
                            <th className="p-1">Type</th>
                            <th className="p-1">Confidence</th>
                            <th className="p-1">Supporting Quotes/Spans</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-150">
                          {docEntities.map((e, idx) => {
                            const quotes =
                              graph.source_refs?.filter(
                                (s) => e.source_ref_ids?.includes(s.id) && s.document_id === doc.id,
                              ) || [];
                            return (
                              <tr key={idx}>
                                <td className="p-1 font-bold">{e.label}</td>
                                <td className="p-1 font-mono uppercase text-gray-500">
                                  {e.subtype || e.type}
                                </td>
                                <td className="p-1 font-mono">{Math.round(e.confidence * 100)}%</td>
                                <td className="p-1 italic text-gray-600">
                                  {quotes.length > 0 ? (
                                    quotes.map((q, i) => (
                                      <span
                                        key={i}
                                        className="block border-l border-gray-300 pl-1.5 mb-0.5"
                                      >
                                        &ldquo;{q.text}&rdquo;
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-gray-400">Direct extraction</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-xs text-gray-400 italic">
                        No structured evidence extracted.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 text-black">
            <h2 className="text-lg font-bold border-b border-gray-300 pb-1 uppercase">
              8. Pipeline Audit Trail
            </h2>
            <div className="border border-gray-200 rounded overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-100 uppercase font-bold">
                  <tr>
                    <th className="p-2 w-16">Step</th>
                    <th className="p-2 w-48">Pipeline Stage</th>
                    <th className="p-2">Status Details</th>
                    <th className="p-2 text-right">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-mono">
                  {termLog
                    .filter((l) => l.startsWith("  ["))
                    .map((line, idx) => {
                      const cleanLine = line.replace(/^\s+/, "");
                      const closeIdx = cleanLine.indexOf("]");
                      const stageRaw = cleanLine.substring(1, closeIdx);
                      const msg = cleanLine.substring(closeIdx + 2);
                      const eventStage = stageRaw.trim();
                      const duration = pipelineEvents[eventStage]?.duration;

                      return (
                        <tr key={idx}>
                          <td className="p-2 text-gray-400">#{idx + 1}</td>
                          <td className="p-2 text-blue-800 uppercase font-bold text-[10px]">
                            {stageRaw.replace(/_/g, " ")}
                          </td>
                          <td className="p-2 text-gray-755 font-sans text-xs">{msg}</td>
                          <td className="p-2 text-right text-gray-600">
                            {duration
                              ? duration >= 1000
                                ? `${(duration / 1000).toFixed(2)}s`
                                : `${Math.round(duration)}ms`
                              : "N/A"}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* P10: Audit Mode Dev Panel (Ctrl+Shift+D) */}
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
      {selectedNodeId && selectedNode && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedNodeId(null)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-xl bg-background border-t border-border shadow-2xl">
            <div className="mx-auto w-full max-w-5xl p-6">
              <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-border/60" />
              <NodeInspector
                node={selectedNode}
                edges={graph?.edges ?? []}
                nodes={graph?.nodes ?? []}
                onClose={() => setSelectedNodeId(null)}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Evidence Graph (SVG View — Full-Width) ──────────────────────────────────
const TYPE_COLOR: Record<string, string> = {
  document: "oklch(0.55 0.12 258)", // electric blue
  entity: "oklch(0.62 0.16 155)", // green
  observation: "oklch(0.60 0.15 55)", // amber
  anomaly: "oklch(0.55 0.2 18)", // red
  risk: "oklch(0.50 0.22 18)", // dark red
};

const TYPE_ICON: Record<string, string> = {
  document: "📄",
  entity: "🔗",
  observation: "👁",
  anomaly: "⚠",
  risk: "🎯",
};

function EvidenceGraphView({
  nodes,
  edges,
  selectedId,
  onSelect,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Wider viewBox for full-width: 200x100 instead of 100x100
  const VW = 200;
  const VH = 100;

  // Position nodes in structured tiers with more horizontal spread
  const positions = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {};
    const docs = nodes.filter((n) => n.type === "document");
    const ents = nodes.filter(
      (n) => n.type === "entity" || n.type === "observation" || n.type === "anomaly",
    );
    const risks = nodes.filter((n) => n.type === "risk");

    // Documents: Top Row — wide horizontal spread
    docs.forEach((n, i) => {
      const step = VW / (docs.length + 1);
      pos[n.id] = { x: step * (i + 1), y: 18 };
    });

    // Entities/Observations: Middle tier — ellipse layout with more spread
    ents.forEach((n, i) => {
      const angle = (Math.PI * 2 * i) / ents.length - Math.PI / 2;
      pos[n.id] = { x: VW / 2 + 52 * Math.cos(angle), y: 54 + 22 * Math.sin(angle) };
    });

    // Risk: Bottom center
    risks.forEach((n, i) => {
      pos[n.id] = { x: VW / 2 + i * 20, y: 90 };
    });

    return pos;
  }, [nodes]);

  // Edges linked to hovered or selected node
  const activeEdges = useMemo(() => {
    const activeId = hoveredNodeId ?? selectedId;
    if (!activeId) return new Set<string>();
    return new Set(
      edges.filter((e) => e.source === activeId || e.target === activeId).map((e) => e.id),
    );
  }, [hoveredNodeId, selectedId, edges]);

  return (
    <div className="rounded-xl bg-surface ring-1 ring-border/40 dot-grid overflow-hidden relative graph-container">
      {/* Full-width graph with generous height */}
      <div style={{ minHeight: "480px", position: "relative" }}>
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Blue gradient for confirmed edges */}
            <linearGradient id="edge-blue-grad" x1="0" x2="1">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="50%" stopColor="oklch(0.62 0.18 258)" stopOpacity="0.7" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
            {/* Glow filter for active nodes */}
            <filter id="node-glow-filter" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Edge lines — confirmed=blue glow, probable=dashed, contradicts=red dashed */}
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
          })}

          {/* Node circles */}
          {nodes.map((n) => {
            const p = positions[n.id];
            if (!p) return null;
            const isSel = selectedId === n.id;
            const isHov = hoveredNodeId === n.id;
            const isRisk = n.type === "risk";
            const isDoc = n.type === "document";
            const color = TYPE_COLOR[n.type] ?? "oklch(0.55 0.05 270)";
            const radius = isRisk
              ? isSel
                ? 6.5
                : 5.5
              : isDoc
                ? isSel || isHov
                  ? 5.0
                  : 4.0
                : isSel || isHov
                  ? 4.5
                  : 3.5;

            return (
              <g
                key={n.id}
                className="cursor-pointer"
                onClick={() => onSelect(selectedId === n.id ? null : n.id)}
                onMouseEnter={() => setHoveredNodeId(n.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
              >
                {/* Ambient glow ring (always visible for important nodes) */}
                {(isRisk || isDoc) && (
                  <circle cx={p.x} cy={p.y} r={radius + 3} fill={color} fillOpacity={0.06} />
                )}
                {/* Pulsing glow ring on hover/selection */}
                {(isSel || isHov) && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={radius + 4}
                    fill={color}
                    fillOpacity={0.15}
                    className="animate-pulse"
                  />
                )}
                {/* Main node circle */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={radius}
                  fill={color}
                  fillOpacity={isSel ? 1.0 : isHov ? 0.92 : 0.75}
                  stroke={isSel ? "oklch(0.95 0.01 270)" : "transparent"}
                  strokeWidth={isSel ? 0.4 : 0}
                  className="transition-all duration-200"
                  filter={isSel || isHov ? "url(#node-glow-filter)" : undefined}
                />
                {/* Label above node */}
                <text
                  x={p.x}
                  y={p.y - radius - 2}
                  textAnchor="middle"
                  fontSize="3.0"
                  fill={isSel || isHov ? "oklch(0.97 0.005 270)" : "oklch(0.82 0.005 270)"}
                  className="pointer-events-none font-mono font-semibold tracking-tight"
                >
                  {n.label.length > 22 ? n.label.slice(0, 20) + "…" : n.label}
                </text>
                {/* Type badge below node */}
                <text
                  x={p.x}
                  y={p.y + radius + 3.5}
                  textAnchor="middle"
                  fontSize="2.0"
                  fill={color}
                  fillOpacity={0.7}
                  className="pointer-events-none font-mono uppercase"
                >
                  {n.subtype?.replace(/_/g, " ") || n.type}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Legend bar */}
        <div className="absolute bottom-4 left-5 flex flex-wrap gap-x-5 gap-y-1.5 bg-background/85 px-4 py-2.5 rounded-lg border border-border/40 backdrop-blur-sm">
          {Object.entries(TYPE_COLOR).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2">
              <span
                className="size-2.5 rounded-full ring-1 ring-white/10"
                style={{ background: color }}
              />
              <span className="font-mono text-[9px] text-white/60 uppercase tracking-wider">
                {type}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border/30">
            <span className="w-5 h-px bg-primary/60" />
            <span className="font-mono text-[9px] text-white/40 uppercase tracking-wider">
              confirmed
            </span>
          </div>
          <div className="flex items-center gap-2">
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
        </div>

        {/* Interaction hint */}
        <div className="absolute bottom-4 right-5 font-mono text-[10px] text-white/25 uppercase tracking-widest pointer-events-none flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-primary/40 animate-pulse" />
          click node to inspect
        </div>
      </div>
    </div>
  );
}

// ─── Playback component ───────────────────────────────────────────────────────
function Playback({ events }: { events: any[] }) {
  const [step, setStep] = useState(events.length - 1);
  const [playing, setPlaying] = useState(false);

  const play = async () => {
    setPlaying(true);
    setStep(0);
    for (let i = 1; i < events.length; i++) {
      await new Promise((r) => setTimeout(r, 650));
      setStep(i);
    }
    setPlaying(false);
  };

  return (
    <div className="rounded-xl bg-surface ring-1 ring-border/40 p-5 relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Step {step + 1} of {events.length}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setStep(0)}
            disabled={playing}
            className="rounded bg-surface-2 ring-1 ring-border/60 px-2.5 py-1 text-[9px] font-mono uppercase tracking-wider hover:bg-surface transition-colors disabled:opacity-40"
          >
            Reset
          </button>
          <button
            onClick={play}
            disabled={playing}
            className="rounded bg-primary text-primary-foreground ring-1 ring-primary/70 px-3 py-1 text-[9px] font-mono uppercase tracking-wider hover:bg-primary/95 transition-colors disabled:opacity-40"
          >
            {playing ? "Playing…" : "Play ▸"}
          </button>
        </div>
      </div>
      <ol className="relative pl-6 space-y-3.5">
        <div className="absolute left-2.5 top-2 bottom-2 w-px bg-border/50" />
        <AnimatePresence>
          {events.slice(0, step + 1).map((ev, idx) => (
            <motion.li
              key={ev.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative"
            >
              <span
                className={`absolute -left-[18px] top-1.5 size-1.5 rounded-full ${idx === step ? "bg-primary shadow-[0_0_10px_oklch(0.62_0.18_258_/_0.7)] scale-110" : "bg-foreground/30"}`}
              />
              <div className="font-mono text-[8px] uppercase tracking-[0.16em] text-primary">
                {ev.kind.replace(/_/g, " ")}
              </div>
              <div className="text-[13px] text-foreground/90 font-medium mt-0.5">{ev.title}</div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </div>
  );
}

// ─── Node Inspector ───────────────────────────────────────────────────────────
function NodeInspector({
  node,
  edges,
  nodes,
  onClose,
}: {
  node: GraphNode;
  edges: GraphEdge[];
  nodes: GraphNode[];
  onClose: () => void;
}) {
  const connectedNodes = useMemo(() => {
    const linked = edges.filter((e) => e.source === node.id || e.target === node.id);
    return linked
      .map((e) => {
        const otherId = e.source === node.id ? e.target : e.source;
        const other = nodes.find((n) => n.id === otherId);
        return { edge: e, node: other };
      })
      .filter((x): x is { edge: GraphEdge; node: GraphNode } => !!x.node);
  }, [node, edges, nodes]);

  // Derived details
  const nodeOrigin = useMemo(() => {
    if (node.type === "document") return node.data?.filename || "Source Document";
    if (node.data?.document_roles) {
      return node.data.document_roles
        .map((r: string) => r.replace("_pdf", "").replace("_email", "").replace("_image", "photo"))
        .join(", ");
    }
    return "Correlation Engine";
  }, [node]);

  const extractionMethod = useMemo(() => {
    if (node.type === "document")
      return `Pipeline File Ingestion / ${node.data?.parser || "unknown"}`;
    if (node.type === "risk") return "FastAPI Risk Contribution Calculator";
    if (
      node.subtype === "damage_observation" &&
      node.data?.document_roles?.includes("damage_image")
    ) {
      return "Gemini Vision API (ocr/labels)";
    }
    if (node.subtype === "damage_observation") return "NLP Pattern Matcher";
    return "LLM Entity Extractor (gemini-1.5-flash)";
  }, [node]);

  return (
    <div className="font-sans">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <span className="inline-block rounded bg-primary/10 text-primary ring-1 ring-primary/30 px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest mb-2">
            {node.type}
            {node.subtype ? ` · ${node.subtype.replace(/_/g, " ")}` : ""}
          </span>
          <h2 className="text-xl font-medium tracking-tight text-foreground font-sans">
            {node.label}
          </h2>
          {node.description && (
            <p className="text-sm text-muted-foreground mt-1.5 font-sans">{node.description}</p>
          )}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <ConfidenceLabel
            confidence={Math.round(node.confidence * 100)}
            label={strengthForConfidence(Math.round(node.confidence * 100))}
            compact
          />
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground ring-1 ring-border/60 hover:bg-surface-2 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
        {/* Origin & Extraction Method details */}
        <div className="space-y-4">
          <div>
            <Mono>Node Provenance</Mono>
            <div className="mt-2.5 space-y-2 text-xs">
              <div className="bg-surface ring-1 ring-border/50 rounded-lg p-3.5 flex justify-between items-center">
                <span className="text-muted-foreground">Node Origin</span>
                <span className="font-mono text-foreground uppercase tracking-wide text-[10px] font-semibold">
                  {nodeOrigin}
                </span>
              </div>
              <div className="bg-surface ring-1 ring-border/50 rounded-lg p-3.5 flex justify-between items-center">
                <span className="text-muted-foreground">Extraction Method</span>
                <span className="font-mono text-primary text-[10px] font-semibold">
                  {extractionMethod}
                </span>
              </div>
              <div className="bg-surface ring-1 ring-border/50 rounded-lg p-3.5 flex justify-between items-center">
                <span className="text-muted-foreground">Calibration Confidence</span>
                <span className="font-mono text-success font-semibold">
                  {Math.round(node.confidence * 100)}%
                </span>
              </div>
            </div>
          </div>

          <div>
            <Mono>Correlated Connections ({connectedNodes.length})</Mono>
            <div className="mt-2.5 space-y-2 max-h-60 overflow-y-auto pr-1">
              {connectedNodes.length === 0 && (
                <p className="text-xs text-muted-foreground italic font-sans">
                  No connections resolved.
                </p>
              )}
              {connectedNodes.map(({ edge, node: other }) => (
                <div
                  key={edge.id}
                  className="flex items-center gap-3 rounded bg-surface ring-1 ring-border/50 px-3.5 py-3 hover:bg-surface-2 transition-all"
                >
                  <span
                    className={`size-1.5 rounded-full shrink-0 ${edge.status === "confirmed" ? "bg-green-400" : edge.status === "probable" ? "bg-yellow-400 animate-pulse" : "bg-muted-foreground"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold truncate text-foreground font-sans">
                      {other.label}
                    </div>
                    <div className="font-mono text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wider">
                      {edge.label || edge.type} · {Math.round(edge.confidence * 100)}% ·{" "}
                      {edge.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Raw Metadata */}
        <div>
          <Mono>Ground Truth Metadata</Mono>
          <pre className="mt-2.5 rounded bg-[oklch(0.09_0.005_270)] border border-white/5 p-4 text-[10px] font-mono text-white/60 overflow-auto max-h-[280px] leading-relaxed select-text">
            {JSON.stringify(
              {
                confidence: node.confidence,
                severity: node.severity,
                ...node.data,
              },
              null,
              2,
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}
