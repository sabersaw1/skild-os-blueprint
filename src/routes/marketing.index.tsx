import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import {
  useMarketingOpportunities,
  useMarketingRepository,
  useRetentionOpportunities,
  useSearchOpportunities,
} from "@/modules/marketing/hooks";
import { formatDenver } from "@/modules/communication/data/time";

export const Route = createModuleRoute("/marketing/")({
  moduleId: "marketing",
  head: () => ({
    meta: [
      { title: "Marketing Opportunities — Skild OS" },
      {
        name: "description",
        content:
          "Evidence-backed marketing opportunities awaiting human review and approval.",
      },
      { property: "og:title", content: "Marketing Opportunities — Skild OS" },
      {
        property: "og:description",
        content:
          "Every opportunity carries its evidence source. Nothing publishes without approval.",
      },
    ],
  }),
  component: MarketingOpportunities,
});

function MarketingOpportunities() {
  const repo = useMarketingRepository();
  const { data: opportunities, loading, refresh } = useMarketingOpportunities();
  const { data: search } = useSearchOpportunities();
  const { data: retention } = useRetentionOpportunities();
  const canRead = useHasCapability("marketing.read");
  const canWrite = useHasCapability("marketing.write");
  const canApprove = useHasCapability("marketing.approve");
  const [error, setError] = useState<string | null>(null);

  if (!canRead) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        You do not have permission to view marketing.
      </p>
    );
  }

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Marketing opportunities
        </h1>
        <p className="text-xs text-muted-foreground">
          Each item records where its evidence came from. Skild OS proposes;
          a human decides.
        </p>
      </header>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : opportunities.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No opportunities recorded. They arrive from measured data or from a
          human observation — never invented.
        </p>
      ) : (
        <ul className="space-y-2">
          {opportunities.map((o) => (
            <li
              key={o.id}
              className="rounded-md border border-border p-3 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{o.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.type.replace(/_/g, " ")} · evidence {o.evidenceSource} ·{" "}
                    {formatDenver(o.createdAt)}
                  </p>
                  {o.evidence && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {o.evidence}
                    </p>
                  )}
                  {o.recommendation && (
                    <p className="mt-1 text-xs">{o.recommendation}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  <Badge variant="secondary">
                    {o.status.replace(/_/g, " ")}
                  </Badge>
                  <Badge variant="outline">confidence {o.confidence}</Badge>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {canWrite && o.status === "identified" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void run(() => repo.reviewOpportunity(o.id))}
                  >
                    Mark reviewed
                  </Button>
                )}
                {canApprove && o.status === "reviewing" && (
                  <Button
                    size="sm"
                    onClick={() => void run(() => repo.approveOpportunity(o.id))}
                  >
                    Approve
                  </Button>
                )}
                {canWrite &&
                  o.status !== "dismissed" &&
                  o.status !== "actioned" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        void run(() => repo.dismissOpportunity(o.id))
                      }
                    >
                      Dismiss
                    </Button>
                  )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium">Search opportunities</h2>
        {search.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No measured search data recorded yet.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {search.slice(0, 10).map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <span className="truncate">{s.query}</span>
                <Badge variant="outline">score {s.opportunityScore}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">Retention opportunities</h2>
        {retention.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No previous customers are due a follow-up based on recorded work.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {retention.slice(0, 10).map((r) => (
              <li
                key={r.customerId}
                className="rounded-md border border-border px-3 py-2"
              >
                <p className="truncate text-xs">Customer {r.customerId}</p>
                <p className="text-xs text-muted-foreground">
                  {r.reasons.join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
