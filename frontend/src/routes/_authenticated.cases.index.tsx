import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listCases, createCase } from "@/lib/cases.functions";
import { Mono, StatusPill, MoneyExposure } from "@/components/forensic/primitives";
import { toast } from "sonner";

const casesQuery = queryOptions({
  queryKey: ["cases"],
  queryFn: () => listCases(),
});

export const Route = createFileRoute("/_authenticated/cases/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(casesQuery),
  component: CasesIndex,
});

function CasesIndex() {
  const { data: cases } = useSuspenseQuery(casesQuery);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const create = useServerFn(createCase);
  const [title, setTitle] = useState("");
  const m = useMutation({
    mutationFn: (t: string) => create({ data: { title: t } }),
    onSuccess: (row: any) => {
      qc.invalidateQueries({ queryKey: ["cases"] });
      navigate({ to: "/cases/$caseId", params: { caseId: row.id } });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const needsReview = cases.filter((c: any) => c.needs_review_count > 0).length;

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex items-end justify-between mb-8">
        <div>
          <Mono>Investigator Console</Mono>
          <h1 className="mt-2 text-3xl font-medium tracking-tight">Cases</h1>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground">
          {needsReview > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 text-warning ring-1 ring-warning/30 px-2.5 py-1">
              <span className="size-1.5 rounded-full bg-warning animate-pulse" />
              {needsReview} need review
            </span>
          )}
          <span>{cases.length} total</span>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) {
            m.mutate(title.trim());
            setTitle("");
          }
        }}
        className="mb-8 flex gap-2 rounded-lg bg-surface ring-1 ring-border/60 p-2"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Open a new case…  (e.g. ‘Shipment SHP-10488 shortage’)"
          className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none placeholder:text-muted-foreground"
        />
        <button
          disabled={m.isPending || !title.trim()}
          className="rounded-md bg-primary text-primary-foreground ring-1 ring-primary/70 px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {m.isPending ? "Opening…" : "Open Case"}
        </button>
      </form>

      {cases.length === 0 ? (
        <div className="rounded-lg bg-surface ring-1 ring-border/40 p-12 text-center">
          <Mono>No cases yet</Mono>
          <p className="mt-3 text-sm text-muted-foreground">
            Open a case above to begin an investigation.
          </p>
        </div>
      ) : (
        <div className="rounded-lg bg-surface ring-1 ring-border/40 overflow-hidden divide-y divide-border/40">
          {cases.map((c: any) => (
            <Link
              key={c.id}
              to="/cases/$caseId"
              params={{ caseId: c.id }}
              className="block px-6 py-4 hover:bg-surface-2 transition-colors"
            >
              <div className="flex items-center gap-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <StatusPill status={c.status} />
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {c.reference}
                    </span>
                  </div>
                  <div className="text-[15px] font-medium text-foreground truncate">{c.title}</div>
                </div>
                {c.financial_exposure_cents > 0 && (
                  <div className="text-right">
                    <MoneyExposure cents={c.financial_exposure_cents} label="Exposure" size="sm" />
                  </div>
                )}
                <div className="font-mono text-[10px] text-muted-foreground w-20 text-right">
                  {new Date(c.created_at).toLocaleDateString()}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
