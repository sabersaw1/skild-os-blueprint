import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { useAutomationOverview } from "../hooks";

export function AutomationStatusWidget() {
  const { data, loading } = useAutomationOverview();

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const rows: Array<{ label: string; value: number; tone?: "warn" | "bad" }> = [
    { label: "Active agents", value: data.activeAgents },
    { label: "Active automations", value: data.activeAutomations },
    {
      label: "Awaiting approval",
      value: data.pendingApprovals,
      tone: data.pendingApprovals > 0 ? "warn" : undefined,
    },
    { label: "Blocked actions", value: data.blockedActions },
    {
      label: "Failed runs",
      value: data.failedRuns,
      tone: data.failedRuns > 0 ? "bad" : undefined,
    },
    { label: "Runs completed today", value: data.completedRunsToday },
  ];

  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{r.label}</span>
            <Badge
              variant={
                r.tone === "bad"
                  ? "destructive"
                  : r.tone === "warn"
                    ? "default"
                    : "secondary"
              }
            >
              {r.value}
            </Badge>
          </li>
        ))}
      </ul>
      <Link
        to="/automation"
        className="text-xs text-muted-foreground hover:underline"
      >
        Open Automation
      </Link>
    </div>
  );
}
