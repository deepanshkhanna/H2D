// Pure, client-safe helpers.
export type StrengthLabel = "strong" | "confirmed" | "likely" | "weak" | "unverified";

export function strengthForConfidence(confidence: number): StrengthLabel {
  if (confidence >= 95) return "strong";
  if (confidence >= 85) return "confirmed";
  if (confidence >= 70) return "likely";
  if (confidence >= 55) return "weak";
  return "unverified";
}

export const STRENGTH_COPY: Record<StrengthLabel, string> = {
  strong: "Strong Evidence",
  confirmed: "Confirmed",
  likely: "Likely",
  weak: "Weak Correlation",
  unverified: "Unverified",
};

export function strengthToneClass(label: StrengthLabel) {
  switch (label) {
    case "strong":
      return "text-success";
    case "confirmed":
      return "text-primary";
    case "likely":
      return "text-foreground";
    case "weak":
      return "text-warning";
    case "unverified":
      return "text-muted-foreground";
  }
}

export function formatMoneyCents(cents: number) {
  const dollars = cents / 100;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function shortHash(hash: string | null | undefined) {
  if (!hash) return "—";
  const c = hash.replace(/[^A-Fa-f0-9]/g, "").toUpperCase();
  return `${c.slice(0, 4)}-${c.slice(4, 8)}`;
}

export const STATUS_LABEL: Record<string, string> = {
  investigating: "Investigating",
  correlating: "Correlating",
  review_needed: "Review Needed",
  confirmed: "Confirmed",
  resolved: "Resolved",
};

export function statusTone(status: string) {
  switch (status) {
    case "investigating":
      return "bg-muted/40 text-muted-foreground ring-border";
    case "correlating":
      return "bg-primary/10 text-primary ring-primary/30";
    case "review_needed":
      return "bg-warning/10 text-warning ring-warning/30";
    case "confirmed":
      return "bg-success/10 text-success ring-success/30";
    case "resolved":
      return "bg-muted/30 text-muted-foreground ring-border";
    default:
      return "bg-muted/40 text-muted-foreground ring-border";
  }
}
