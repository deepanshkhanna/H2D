/**
 * EvidenceGraphView — dependency-free SVG renderer for the backend evidence
 * graph (Phase T5). Deliberately avoids react-flow/d3 so it adds no new
 * dependency and works in constrained environments.
 *
 * Layout: nodes are placed in vertical columns by semantic type
 * (document → entity → observation/anomaly → risk); edges are drawn as curved
 * connectors whose opacity/width encode confidence.
 */

import { useMemo } from "react";
import type {
  EvidenceGraph,
  EvidenceNode,
  EvidenceEdge,
  NodeType,
} from "@/lib/api/opspilot";

const COLUMN_ORDER: NodeType[] = [
  "document",
  "entity",
  "observation",
  "anomaly",
  "risk",
];

const TYPE_COLOR: Record<NodeType, string> = {
  document: "#3b82f6",
  entity: "#22c55e",
  observation: "#eab308",
  anomaly: "#f97316",
  risk: "#ef4444",
};

const NODE_W = 168;
const NODE_H = 56;
const COL_GAP = 240;
const ROW_GAP = 80;
const PAD_X = 40;
const PAD_Y = 40;

interface Placed {
  node: EvidenceNode;
  x: number;
  y: number;
}

function layout(nodes: EvidenceNode[]): { placed: Map<string, Placed>; width: number; height: number } {
  const columns = new Map<NodeType, EvidenceNode[]>();
  for (const t of COLUMN_ORDER) columns.set(t, []);
  for (const n of nodes) {
    const bucket = columns.get(n.type) ?? columns.get("entity")!;
    bucket.push(n);
  }

  const placed = new Map<string, Placed>();
  let maxRows = 0;
  COLUMN_ORDER.forEach((type, colIdx) => {
    const col = columns.get(type) ?? [];
    maxRows = Math.max(maxRows, col.length);
    col.forEach((node, rowIdx) => {
      placed.set(node.id, {
        node,
        x: PAD_X + colIdx * COL_GAP,
        y: PAD_Y + rowIdx * (NODE_H + ROW_GAP),
      });
    });
  });

  const width = PAD_X * 2 + (COLUMN_ORDER.length - 1) * COL_GAP + NODE_W;
  const height = PAD_Y * 2 + Math.max(1, maxRows) * (NODE_H + ROW_GAP);
  return { placed, width, height };
}

function edgeColor(edge: EvidenceEdge): string {
  if (edge.type === "contradicts") return "#ef4444";
  if (edge.status === "probable") return "#eab308";
  return "#64748b";
}

export function EvidenceGraphView({ graph }: { graph: EvidenceGraph }) {
  const { placed, width, height } = useMemo(() => layout(graph.nodes), [graph.nodes]);

  return (
    <div className="w-full overflow-auto rounded-lg border border-border bg-card">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label="Evidence correlation graph"
        style={{ minHeight: 360 }}
      >
        {/* Edges */}
        {graph.edges.map((edge) => {
          const a = placed.get(edge.source);
          const b = placed.get(edge.target);
          if (!a || !b) return null;
          const x1 = a.x + NODE_W;
          const y1 = a.y + NODE_H / 2;
          const x2 = b.x;
          const y2 = b.y + NODE_H / 2;
          const mx = (x1 + x2) / 2;
          const conf = Math.max(0, Math.min(1, edge.confidence ?? 0.5));
          return (
            <g key={edge.id}>
              <path
                d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={edgeColor(edge)}
                strokeWidth={1 + conf * 2.5}
                strokeOpacity={0.35 + conf * 0.5}
                strokeDasharray={edge.status === "probable" ? "5 4" : undefined}
              />
              {edge.label && (
                <text
                  x={mx}
                  y={(y1 + y2) / 2 - 4}
                  fontSize={10}
                  textAnchor="middle"
                  fill="currentColor"
                  opacity={0.6}
                >
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {[...placed.values()].map(({ node, x, y }) => {
          const color = TYPE_COLOR[node.type] ?? "#64748b";
          return (
            <g key={node.id}>
              <rect
                x={x}
                y={y}
                width={NODE_W}
                height={NODE_H}
                rx={8}
                fill={color}
                fillOpacity={0.12}
                stroke={color}
                strokeWidth={1.5}
              />
              <text x={x + 12} y={y + 22} fontSize={12} fontWeight={600} fill="currentColor">
                {truncate(node.label, 22)}
              </text>
              <text x={x + 12} y={y + 40} fontSize={10} fill="currentColor" opacity={0.6}>
                {node.subtype ?? node.type} · {Math.round((node.confidence ?? 0) * 100)}%
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 border-t border-border px-4 py-2 text-xs">
        {COLUMN_ORDER.map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: TYPE_COLOR[t] }}
            />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
