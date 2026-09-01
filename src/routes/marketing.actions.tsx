import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import {
  useMarketingActions,
  useMarketingRepository,
} from "@/modules/marketing/hooks";
import { formatDenver } from "@/modules/communication/data/time";

export const Route = createModuleRoute("/marketing/actions")({
  moduleId: "marketing",
  head: () => ({
    meta: [
      { title: "Marketing Actions — Skild OS" },
      {
        name: "description",
        content:
          "Recommended marketing actions and their approval history. Skild OS publishes nothing on its own.",
      },
      { property: "og:title", content: "Marketing Actions — Skild OS" },
      {
        property: "og:description",
        content:
          "Recommend, review, approve, execute, measure — every step performed by a human.",
      },
    ],
  }),
  component: MarketingActions,
});

function MarketingActions() {
  const repo = useMarketingRepository();
  const { data: actions, loading, refresh } = useMarketingActions();
  const canRead = useHasCapability("marketing.read");
  const canWrite = useHasCapability("marketing.write");
  const canApprove = useHasCapability("marketing.approve");
  const canPublish = useHasCapability("marketing.publish");
  const [error, setError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});

  if (!canRead) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        You do not have permission to view marketing actions.
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
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Marketing actions
        </h1>
        <p className="text-xs text-muted-foreground">
          Public-facing actions additionally require the publish capability at
          execution time.
        </p>
      </header>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : actions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No actions recommended yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {actions.map((a) => (
            <li
              key={a.id}
              className="rounded-md border border-border p-3 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.type.replace(/_/g, " ")}
                    {a.target ? ` · ${a.target}` : ""} ·{" "}
                    {formatDenver(a.createdAt)}
                  </p>
                  {a.description && (
                    <p className="mt-1 text-xs">{a.description}</p>
                  )}
                  {a.outcome && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Outcome: {a.outcome}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  <Badge variant="secondary">
                    {a.status.replace(/_/g, " ")}
                  </Badge>
                  {a.publicFacing && (
                    <Badge variant="outline">public-facing</Badge>
                  )}
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {canWrite && a.status === "recommended" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void run(() => repo.reviewAction(a.id))}
                  >
                    Mark reviewed
                  </Button>
                )}
                {canApprove && a.status === "reviewed" && (
                  <Button
                    size="sm"
                    onClick={() => void run(() => repo.approveAction(a.id))}
                  >
                    Approve
                  </Button>
                )}
                {a.status === "approved" &&
                  (a.publicFacing ? canPublish : canWrite) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void run(() => repo.markActionExecuted(a.id))
                      }
                    >
                      I did this
                    </Button>
                  )}
                {canWrite && a.status === "executed" && (
                  <>
                    <Input
                      className="h-8 w-56"
                      placeholder="Measured outcome"
                      value={outcomes[a.id] ?? ""}
                      onChange={(e) =>
                        setOutcomes((prev) => ({
                          ...prev,
                          [a.id]: e.target.value,
                        }))
                      }
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void run(() =>
                          repo.measureAction(a.id, outcomes[a.id] ?? ""),
                        )
                      }
                    >
                      Record measurement
                    </Button>
                  </>
                )}
                {canWrite &&
                  ["recommended", "reviewed", "approved"].includes(a.status) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void run(() => repo.rejectAction(a.id))}
                    >
                      Reject
                    </Button>
                  )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
