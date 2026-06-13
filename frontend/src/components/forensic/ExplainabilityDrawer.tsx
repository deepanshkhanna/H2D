import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Mono, EvidenceChip } from "./primitives";

export function ExplainabilityDrawer({ isOpen, onOpenChange, conclusion, evidenceList }: any) {
  if (!conclusion) return null;

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <div className="mx-auto w-full max-w-5xl p-6 overflow-y-auto">
          <DrawerHeader className="px-0 pt-0 text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary ring-1 ring-primary/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em]">
                {conclusion.is_primary ? "Primary Conclusion" : "Secondary Conclusion"}
              </div>
              {conclusion.needs_human_review && (
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 text-warning ring-1 ring-warning/30 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em]">
                    <span className="size-1.5 rounded-full bg-warning animate-pulse" />
                    Needs Human Review
                  </span>
                </div>
              )}
            </div>
            <DrawerTitle className="text-2xl md:text-3xl font-medium mt-3">
              {conclusion.title}
            </DrawerTitle>
            <DrawerDescription className="text-foreground/80 mt-3 text-base">
              {conclusion.root_cause}
            </DrawerDescription>
          </DrawerHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mt-8">
            <div className="space-y-8">
              <div>
                <Mono>Reasoning</Mono>
                <p className="mt-3 text-sm text-foreground/90 leading-relaxed bg-surface ring-1 ring-border/50 rounded-lg p-4 shadow-inner">
                  {conclusion.reasoning}
                </p>
              </div>

              <div>
                <Mono>Confidence & Exposure</Mono>
                <div className="mt-4 space-y-2.5 text-sm">
                  <div className="flex justify-between items-center bg-surface ring-1 ring-border/50 rounded-lg px-4 py-3">
                    <div className="text-foreground/90 font-medium">Confidence Score</div>
                    <span className="font-mono text-primary text-base">
                      {conclusion.confidence}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-surface ring-1 ring-border/50 rounded-lg px-4 py-3">
                    <div className="text-foreground/90 font-medium">Severity</div>
                    <span className="font-mono text-foreground capitalize text-base">
                      {conclusion.severity}
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-surface-2 ring-1 ring-border/80 rounded-lg px-4 py-3 mt-5 font-semibold text-base">
                    <span>Financial Exposure</span>
                    <span className="font-mono text-destructive">
                      ${(conclusion.financial_exposure_cents / 100).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              {conclusion.recommended_action && (
                <div>
                  <Mono>Recommended Action</Mono>
                  <div className="mt-3 rounded-lg bg-foreground text-background text-sm font-medium py-3 px-4 shadow-md">
                    {conclusion.recommended_action}
                  </div>
                </div>
              )}

              <div>
                <Mono>Source Evidence Highlights</Mono>
                <div className="mt-4 flex flex-wrap gap-2">
                  {evidenceList?.length > 0 ? (
                    evidenceList.map((ev: any) => (
                      <EvidenceChip
                        key={ev.id}
                        label={`${ev.kind} · ${ev.filename}`}
                        tone="primary"
                      />
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No evidence directly linked.
                    </p>
                  )}
                </div>
                {evidenceList?.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {evidenceList.map((ev: any) => (
                      <div key={ev.id} className="bg-surface ring-1 ring-border/50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                            {ev.kind}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/90 leading-relaxed font-serif italic text-pretty border-l-2 border-primary/40 pl-3">
                          {ev.summary || "Extracted content..."}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
