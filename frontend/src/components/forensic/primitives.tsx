import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  STATUS_LABEL,
  STRENGTH_COPY,
  type StrengthLabel,
  formatMoneyCents,
  statusTone,
  strengthToneClass,
} from "@/lib/strength";

export function Grain({ className }: { className?: string }) {
  return <div className={cn("grain absolute inset-0", className)} aria-hidden />;
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", className)}>
      {children}
    </span>
  );
}

export function StatusPill({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ring-1",
        statusTone(status),
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-80" />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function ConfidenceLabel({
  confidence,
  label,
  compact = false,
}: {
  confidence: number;
  label: StrengthLabel;
  compact?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(confidence)));
  return (
    <div className={cn("flex flex-col", compact ? "gap-0.5" : "gap-1.5")}>
      <div className="flex items-baseline gap-2">
        <span className={cn(compact ? "text-base" : "text-2xl", "font-semibold tabular-nums", strengthToneClass(label))}>
          {pct}%
        </span>
        <span className={cn("text-[11px] uppercase tracking-[0.16em]", strengthToneClass(label), "opacity-80")}>
          {STRENGTH_COPY[label]}
        </span>
      </div>
      <div className="h-0.5 w-full rounded-full bg-border/40 overflow-hidden">
        <div
          className={cn(
            "h-full transition-all",
            label === "strong" || label === "confirmed" ? "bg-primary" : label === "likely" ? "bg-foreground/60" : label === "weak" ? "bg-warning" : "bg-muted-foreground",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function MoneyExposure({
  cents,
  label = "Financial Exposure",
  size = "md",
}: {
  cents: number;
  label?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass = size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-xl";
  return (
    <div className="flex flex-col gap-1">
      <Mono>{label}</Mono>
      <div className={cn(sizeClass, "font-semibold tabular-nums text-foreground")}>
        {formatMoneyCents(cents)}
      </div>
    </div>
  );
}

export function EvidenceChip({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "warning" | "danger" | "primary";
}) {
  const toneClass =
    tone === "warning" ? "bg-warning" : tone === "danger" ? "bg-destructive" : tone === "primary" ? "bg-primary" : "bg-foreground/40";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface ring-1 ring-border/60 px-2.5 py-1 text-[11px] text-foreground/80">
      <span className={cn("size-1.5 rounded-full", toneClass)} />
      {label}
    </span>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Mono className="block mb-3">{children}</Mono>;
}
