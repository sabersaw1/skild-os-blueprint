import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import {
  useAgents,
  useAutomationRepository,
  useAutomationRules,
} from "@/modules/automation/hooks";
import { runAutomationRule } from "@/modules/automation/engine/executor";
import { manualTrigger } from "@/modules/automation/engine/triggers";
import { decideActionPolicy } from "@/modules/automation/data/policy";

export const Route = createModuleRoute("/automation/")({
  moduleId: "automation",
  head: () => ({
    meta: [
      { title: "Agents — Skild OS Automation" },
      {
        name: "description",
        content:
          "Every agent, what it is allowed to do, and whether it is switched on. Agents start disabled.",
      },
      { property: "og:title", content: "Agents — Skild OS Automation" },
      {
        property: "og:description",
        content:
          "Narrow, capability-scoped agents that propose work and never act on their own.",
      },
    ],
  }),
  component: AutomationAgents,
});

function AutomationAgents() {
  const repo = useAutomationRepository();
  const { data: agents, loading, refresh } = useAgents();
  const { data: rules, refresh: refreshRules } = useAutomationRules();
  const canRead = useHasCapability("agents.read");
  const canWrite = useHasCapability("agents.write");
  const canManage = useHasCapability("agents.manage");
  const canRun = useHasCapability("agents.run");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Record<string, string>>({});

  if (!canRead) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        You do not have permission to view automation.
      </p>
    );
  }

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      refresh();
      refreshRules();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4">
      <header>
        <h1 className="text-xl font-semibold">Agents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          An agent observes records and proposes work. It cannot send, publish,
          price, charge or delete — those actions are blocked by policy, not by
          configuration. Consequential work waits for a human approval.
        </p>
      </header>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : agents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No agents yet.</p>
      ) : (
        <ul className="space-y-4">
          {agents.map((agent) => {
            const agentRules = rules.filter((r) => r.agentId === agent.id);
            return (
              <li key={agent.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-medium">{agent.name}</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {agent.purpose}
                    </p>
                  </div>
                  <Badge
                    variant={agent.status === "active" ? "default" : "secondary"}
                  >
                    {agent.status}
                  </Badge>
                </div>

                {canWrite && (
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        act(() =>
                          repo.setAgentEnabled(
                            agent.id,
                            agent.status !== "active",
                          ),
                        )
                      }
                    >
                      {agent.status === "active" ? "Switch off" : "Switch on"}
                    </Button>
                  </div>
                )}

                <ul className="mt-4 space-y-3 border-t pt-3">
                  {agentRules.map((rule) => (
                    <li key={rule.id} className="text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{rule.name}</p>
                          <p className="text-muted-foreground">
                            {rule.description}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {
                              decideActionPolicy(
                                rule.proposedActionType,
                                rule.approvalPolicy,
                              ).reason
                            }
                          </p>
                        </div>
                        <Badge variant={rule.enabled ? "secondary" : "outline"}>
                          {rule.enabled ? "enabled" : "disabled"}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {canManage && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              act(() =>
                                repo.setRuleEnabled(rule.id, !rule.enabled),
                              )
                            }
                          >
                            {rule.enabled ? "Disable rule" : "Enable rule"}
                          </Button>
                        )}
                        {canRun && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy === rule.id}
                            onClick={async () => {
                              setBusy(rule.id);
                              setError(null);
                              try {
                                const report = await runAutomationRule(
                                  rule.id,
                                  { trigger: manualTrigger("manual:ui") },
                                );
                                setOutcome((prev) => ({
                                  ...prev,
                                  [rule.id]:
                                    report.run.outcome ?? "Run complete.",
                                }));
                                refresh();
                              } catch (e) {
                                setError(
                                  e instanceof Error ? e.message : String(e),
                                );
                              } finally {
                                setBusy(null);
                              }
                            }}
                          >
                            {busy === rule.id ? "Running…" : "Run now"}
                          </Button>
                        )}
                      </div>
                      {outcome[rule.id] && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {outcome[rule.id]}
                        </p>
                      )}
                    </li>
                  ))}
                  {agentRules.length === 0 && (
                    <li className="text-sm text-muted-foreground">
                      No rules for this agent.
                    </li>
                  )}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
