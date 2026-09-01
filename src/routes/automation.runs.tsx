import { Badge } from "@/components/ui/badge";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import { useAgentActions, useAgentRuns } from "@/modules/automation/hooks";
import { formatDenver } from "@/modules/communication/data/time";

export const Route = createModuleRoute("/automation/runs")({
  moduleId: "automation",
  head: () => ({
    meta: [
      { title: "Agent Runs — Skild OS Automation" },
      {
        name: "description",
        content:
          "Every agent run, its trigger, its outcome, and every action it produced — successes and failures alike.",
      },
      { property: "og:title", content: "Agent Runs — Skild OS Automation" },
      {
        property: "og:description",
        content:
          "A failed run stays visible. Nothing silently disappears from the record.",
      },
    ],
  }),
  component: AutomationRuns,
});

const RUN_TONE: Record<string, "default" | "secondary" | "destructive" | "outline"> =
  {
    succeeded: "secondary",
    failed: "destructive",
    blocked: "outline",
    awaiting_approval: "default",
    running: "default",
    cancelled: "outline",
    pending: "outline",
  };

function AutomationRuns() {
  const canRead = useHasCapability("agents.read");
  const { data: runs, loading } = useAgentRuns({ limit: 50 });
  const { data: actions } = useAgentActions({ limit: 400 });

  if (!canRead) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        You do not have permission to view agent runs.
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4">
      <header>
        <h1 className="text-xl font-semibold">Runs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Each run records what triggered it, what it observed, what it
          proposed, and what actually happened. Result summaries describe real
          operations only.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No runs yet. Start one from the Agents tab.
        </p>
      ) : (
        <ul className="space-y-4">
          {runs.map((run) => {
            const runActions = actions.filter((a) => a.runId === run.id);
            return (
              <li key={run.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {run.trigger.source}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {formatDenver(run.startedAt)}
                      </span>
                    </p>
                    {run.outcome && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {run.outcome}
                      </p>
                    )}
                    {run.errorMessage && (
                      <p className="mt-1 text-sm text-destructive">
                        {run.errorCode}: {run.errorMessage}
                      </p>
                    )}
                  </div>
                  <Badge variant={RUN_TONE[run.status] ?? "secondary"}>
                    {run.status.replace(/_/g, " ")}
                  </Badge>
                </div>

                {runActions.length > 0 && (
                  <ul className="mt-3 space-y-2 border-t pt-3 text-sm">
                    {runActions.map((a) => (
                      <li key={a.id}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{a.actionType}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {a.policyDecision.replace(/_/g, " ")}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {a.executionState.replace(/_/g, " ")}
                          </Badge>
                          {a.approvalState !== "not_required" && (
                            <Badge className="text-[10px]">
                              {a.approvalState}
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground">{a.rationale}</p>
                        {a.resultSummary && (
                          <p className="text-xs text-muted-foreground">
                            {a.resultSummary}
                          </p>
                        )}
                        {a.errorMessage && (
                          <p className="text-xs text-destructive">
                            {a.errorCode}: {a.errorMessage} (attempt {a.attempt}
                            /{a.maxAttempts})
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
