import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import { useAssistantRepository, useProposals } from "@/modules/assistant/hooks";
import { JARVIS_PROPOSE, JARVIS_READ } from "@/modules/assistant/capabilities";
import type { ProposalRisk } from "@/modules/assistant/data/schemas";

export const Route = createModuleRoute("/jarvis/proposals")({
  moduleId: "assistant",
  head: () => ({
    meta: [
      { title: "AI Proposals — Jarvis — Skild OS" },
      {
        name: "description",
        content:
          "Actions Jarvis suggests. Nothing here is executed by the system — approval is a human decision.",
      },
      { property: "og:title", content: "AI Proposals — Jarvis — Skild OS" },
      {
        property: "og:description",
        content:
          "Every proposal carries its reason, its evidence, its risk, and the capability a future executor would need.",
      },
    ],
  }),
  component: ProposalsPage,
});

const RISK_VARIANT: Record<ProposalRisk, "secondary" | "default" | "destructive"> = {
  low: "secondary",
  medium: "default",
  high: "destructive",
};

function ProposalsPage() {
  const canRead = useHasCapability(JARVIS_READ);
  const canPropose = useHasCapability(JARVIS_PROPOSE);
  const repo = useAssistantRepository();
  const { data: proposals, loading, refresh } = useProposals();
  const [error, setError] = useState<string | null>(null);

  if (!canRead) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        You do not have permission to view proposals.
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
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <header>
        <h1 className="text-xl font-semibold">AI action proposals</h1>
        <p className="text-sm text-muted-foreground">
          Skild OS never carries these out. Approving records your decision;
          &ldquo;mark as done&rdquo; records that a person did it.
        </p>
      </header>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : proposals.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No proposals have been recorded. Draft one from the Needs attention
          tab.
        </p>
      ) : (
        <ul className="space-y-3">
          {proposals.map((p) => (
            <li key={p.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={RISK_VARIANT[p.risk]} className="text-[10px]">
                      {p.risk} risk
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {p.approval}
                    </Badge>
                    {p.execution === "executed_by_human" && (
                      <Badge variant="secondary" className="text-[10px]">
                        done by a person
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 font-medium">{p.title}</p>
                  <p className="text-sm text-muted-foreground">{p.reason}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Would require {p.requiredCapabilityId} · {p.targets.length}{" "}
                    target record(s) · {p.evidence.length} supporting fact(s)
                  </p>
                </div>
                {canPropose && (
                  <div className="flex shrink-0 flex-col gap-1">
                    {p.approval === "pending" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => run(() => repo.approveProposal(p.id))}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => run(() => repo.rejectProposal(p.id))}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {p.approval === "approved" &&
                      p.execution === "not_executed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            run(() => repo.markProposalExecutedByHuman(p.id))
                          }
                        >
                          I did this
                        </Button>
                      )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
