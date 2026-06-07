import { motion } from "framer-motion";
import { EvidenceChip, Mono } from "./primitives";

// The hero "live investigation wall" — pinned evidence cards drifting,
// correlation strings connecting them, a risk card materializing.
// Pure presentation; deterministic positions for a calm, expensive feel.
export function InvestigationWall() {
  return (
    <div className="relative h-[520px] w-full">
      {/* correlation strings */}
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="line" x1="0" x2="1">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="oklch(0.62 0.18 258)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <g className="pulse-line">
          <line x1="18%" y1="22%" x2="62%" y2="44%" stroke="url(#line)" strokeWidth="1" />
          <line x1="62%" y1="44%" x2="34%" y2="74%" stroke="url(#line)" strokeWidth="1" />
          <line x1="62%" y1="44%" x2="86%" y2="20%" stroke="url(#line)" strokeWidth="1" />
          <line x1="34%" y1="74%" x2="78%" y2="78%" stroke="url(#line)" strokeWidth="1" />
        </g>
      </svg>

      {/* Invoice card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: [0, -4, 0] }}
        transition={{
          opacity: { duration: 0.6 },
          y: { duration: 10, repeat: Infinity, ease: "easeInOut" },
        }}
        className="absolute top-[10%] left-[6%] w-56 rotate-[-1.2deg] rounded-sm bg-surface ring-1 ring-border/70 shadow-2xl p-3.5"
      >
        <Mono>Invoice · INV-9204.pdf</Mono>
        <div className="mt-2 space-y-1.5">
          <div className="h-1.5 w-full bg-border/60 rounded" />
          <div className="h-1.5 w-4/5 bg-border/60 rounded" />
          <div className="h-1.5 w-2/3 bg-border/60 rounded" />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="font-mono text-[10px] text-foreground/70">SHP-10488</span>
          <span className="text-[10px] text-muted-foreground">42 units</span>
        </div>
      </motion.div>

      {/* Manifest card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: [0, 3, 0] }}
        transition={{
          opacity: { duration: 0.6, delay: 0.15 },
          y: { duration: 12, repeat: Infinity, ease: "easeInOut" },
        }}
        className="absolute top-[36%] left-[24%] w-60 rotate-[1.4deg] rounded-sm bg-surface ring-1 ring-border/70 shadow-2xl p-3.5"
      >
        <Mono>Manifest · BL-44821</Mono>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] font-mono text-foreground/70">
          <div>
            <span className="text-muted-foreground">Carrier</span>
            <br />
            NorthRail XJ-9
          </div>
          <div>
            <span className="text-muted-foreground">Docked</span>
            <br />
            14:48 UTC
          </div>
        </div>
        <div className="mt-2.5 space-y-1">
          <div className="h-1 w-full bg-border/60 rounded" />
          <div className="h-1 w-3/4 bg-border/60 rounded" />
        </div>
      </motion.div>

      {/* Risk card materializing */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        className="absolute top-[18%] right-[10%] w-64 rounded-md bg-surface ring-1 ring-primary/40 shadow-[0_0_40px_-12px_oklch(0.62_0.18_258_/_0.4)] p-4"
      >
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em]">
            <span className="size-1.5 rounded-full bg-destructive animate-pulse" />
            High Risk
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">CASE-4402</span>
        </div>
        <div className="mt-3 text-[13px] font-medium text-foreground leading-snug">
          13-unit shortage detected across invoice and complaint email.
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <div>
            <Mono>Exposure</Mono>
            <div className="mt-0.5 text-base font-semibold tabular-nums">$63,600</div>
          </div>
          <div className="text-right">
            <Mono>Confidence</Mono>
            <div className="mt-0.5 text-base font-semibold tabular-nums text-primary">94%</div>
          </div>
        </div>
      </motion.div>

      {/* Email card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: [0, -3, 0] }}
        transition={{
          opacity: { duration: 0.6, delay: 0.3 },
          y: { duration: 11, repeat: Infinity, ease: "easeInOut" },
        }}
        className="absolute bottom-[8%] left-[14%] w-56 rotate-[0.6deg] rounded-sm bg-surface ring-1 ring-warning/30 shadow-2xl p-3.5"
      >
        <div className="flex items-center justify-between">
          <Mono>Email · complaint</Mono>
          <span className="size-2 rounded-full bg-warning/70 ring-2 ring-warning/20" />
        </div>
        <div className="mt-2 text-[11px] text-foreground/80 leading-snug">
          "Received 29 units against PO of 42. Where are the other 13?"
        </div>
        <div className="mt-2 font-mono text-[10px] text-muted-foreground">— buyer@acme.co</div>
      </motion.div>

      {/* Photo card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: [0, 3, 0] }}
        transition={{
          opacity: { duration: 0.6, delay: 0.45 },
          y: { duration: 13, repeat: Infinity, ease: "easeInOut" },
        }}
        className="absolute bottom-[12%] right-[6%] w-48 rotate-[-0.8deg] rounded-sm bg-surface ring-1 ring-border/70 shadow-2xl p-3"
      >
        <Mono>Photo · dock_cam_03</Mono>
        <div className="mt-2 aspect-video w-full rounded-sm bg-gradient-to-br from-zinc-800 via-zinc-900 to-black ring-1 ring-black/30 relative overflow-hidden">
          <div className="absolute inset-0 dot-grid opacity-30" />
          <div className="absolute bottom-1 left-1 font-mono text-[8px] text-foreground/40">
            02:14 UTC
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          <EvidenceChip label="damage" tone="warning" />
        </div>
      </motion.div>
    </div>
  );
}
