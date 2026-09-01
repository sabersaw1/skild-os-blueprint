import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import {
  useAgentActions,
  useAutomationRepository,
} from "@/modules/automation/hooks";
import { executeAction } from "@/modules/automation/engine/executor";
import { formatDenver } from "@/modules/communication/data/time";

export const Route = createModuleRoute("/automation/approvals")({
  moduleId: "automation",
  head: () => ({
    meta: [
      { title: "Approvals — Skild OS Automation" },
      {
        name: "description",
        content:
          "Agent actions waiting on a human decision, and the actions policy blocks outright.",
      },
      { property: "og:title", content: "Approvals — Skild OS Automation" },
      {
        property: "og:description",
        content:
          "Approving is a human act. Nothing consequential runs without one.",
      },
    ],
  }),
  component: AutomationApprovals,
});

function AutomationApprovals() {
  const repo = useAutomationRepository();
  const canRead = useHasCapability("agents.read");
  const canApprove = useHasCapability("agents.approve");
  const canRun = useHasCapability("agents.run");
  const { data: pending, loading, refresh } = useAgentActions({
    approvalState: "pending",
  });
  const { data: blocked } = useAgentActions({ executionState: "blocked" });
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  if (!canRead) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        You do not have permission to view approvals.
      </p>
    );
  }

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 p-4">
      <header>
        <h1 className="text-xl font-semibold">Approvals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          An agent proposes; a person decides. Approving records the decision —
          it does not send anything to a customer.
        </p>
      </header>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Awaiting a decision</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing is waiting on you.
          </p>
        ) : (
          <ul className="space-y-3">
            {pending.map((a) => (
              <li key={a.id} className="rounded-lg border p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{a.actionType}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {a.targets.length} target(s)
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDenver(a.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground">{a.rationale}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {a.policyReason}
                </p>
                {canApprove && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Input
                      value={reasons[a.id] ?? ""}
                      placeholder="Reason (optional)"
                      className="h-8 max-w-xs"
                      onChange={(e) =>
                        setReasons((prev) => ({
                          ...prev,
                          [a.id]: e.target.value,
                        }))
                      }
                    />
                    <Button
                      size="sm"
                      onClick={() =>
                        act(async () => {
                          await repo.approveAction(a.id, reasons[a.id]);
                          if (canRun) await executeAction(a.id);
                        })
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        act(() => repo.rejectAction(a.id, reasons[a.id]))
                      }
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Blocked by policy</h2>
        <p className="text-xs text-muted-foreground">
          These are never executable, by anyone, from here. Do the work in the
          owning module.
        </p>
        {blocked.length === 0 ? (
          <p className="text-sm text-muted-foreground">None.</p>
        ) : (
          <ul className="space-y-2">
            {blocked.map((a) => (
              <li key={a.id} className="rounded-md border p-3 text-sm">
                <span className="font-medium">{a.actionType}</span>
                <p className="text-muted-foreground">{a.policyReason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
