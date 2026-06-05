/**
 * Typed client for the OpsPilot FastAPI backend (ADR-002: the single source of
 * truth for the evidence pipeline and graph). Phase T5 integration.
 *
 * The backend base URL comes from VITE_OPSPILOT_API_URL and defaults to the
 * local dev server.
 *
 * IMPORTANT — API-key handling:
 *   Write calls (POST /api/incidents) MUST be made via a TanStack Start server
 *   function that reads OPSPILOT_API_KEY from process.env (server-only).
 *   Never put the backend write API key in a VITE_ variable — it would be
 *   bundled into the browser payload.
 *   Read calls (GET /api/jobs/:id, GET /api/incidents/:id/graph) are open and
 *   safe to make directly from the browser.
 */

// ── Evidence-graph contract (mirrors backend/app/models.py) ──────────────────

export type NodeType =
  | "document"
  | "entity"
  | "observation"
  | "anomaly"
  | "risk";

export type EdgeType =
  | "contains"
  | "supports"
  | "correlates_with"
  | "contradicts"
  | "derived_from"
  | "mentions"
  | "same_as"
  | "causes_risk"
  | "requires_review";

export interface ConfidenceBreakdown {
  final: number;
  threshold: number;
  decision: "accept" | "warn" | "reject" | string;
  components: Record<string, number>;
  weights: Record<string, number>;
  calibration_note?: string;
}

export interface EvidenceNode {
  id: string;
  type: NodeType;
  subtype?: string;
  label: string;
  description?: string;
  confidence: number; // 0..1
  source_ref_ids: string[];
  data?: Record<string, unknown>;
}

export interface EvidenceEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label?: string;
  confidence: number; // 0..1
  status?: "confirmed" | "probable" | "weak" | "rejected" | string;
  evidence_ref_ids?: string[];
  confidence_breakdown?: ConfidenceBreakdown;
  explanation_id?: string;
}

export interface EvidenceGraph {
  metadata: Record<string, unknown>;
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
  source_refs?: unknown[];
  explanations?: unknown[];
}

export interface JobEventResponse {
  id: string;
  job_id: string;
  stage: string;
  message: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface JobResponse {
  id: string;
  incident_id: string;
  /** Job lifecycle status: queued | files_stored | ... | completed | failed */
  status: string;
  stage: string;
  /** 0–100 progress percentage */
  progress: number;
  error: string | null;
  events: JobEventResponse[];
  created_at: string;
  updated_at: string;
}

// ── Client ───────────────────────────────────────────────────────────────────

const BASE_URL =
  (import.meta.env.VITE_OPSPILOT_API_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:8000";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body?.detail) detail = body.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(`OpsPilot API ${res.status}: ${detail}`);
  }
  return (await res.json()) as T;
}

export const opspilot = {
  baseUrl: BASE_URL,

  /** Static demo evidence graph straight from the backend. */
  async getDemoGraph(signal?: AbortSignal): Promise<EvidenceGraph> {
    const res = await fetch(`${BASE_URL}/api/demo/graph`, { signal });
    return handle<EvidenceGraph>(res);
  },

  /** Generated graph for a processed incident (read — no auth required). */
  async getGraph(incidentId: string, signal?: AbortSignal): Promise<EvidenceGraph> {
    const res = await fetch(`${BASE_URL}/api/incidents/${incidentId}/graph`, { signal });
    return handle<EvidenceGraph>(res);
  },

  /**
   * Poll job status (read — no auth required).
   * Callers should poll every 2 s and stop when status is "completed" or "failed".
   */
  async getJob(jobId: string, signal?: AbortSignal): Promise<JobResponse> {
    const res = await fetch(`${BASE_URL}/api/jobs/${jobId}`, { signal });
    return handle<JobResponse>(res);
  },

};
