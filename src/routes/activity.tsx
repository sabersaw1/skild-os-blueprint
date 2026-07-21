import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useActivity, clearActivity } from "@/core/activity/emitter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity — Skild OS" },
      {
        name: "description",
        content: "Recent activity across Skild OS (in-memory in Phase 1).",
      },
    ],
  }),
  component: ActivityFeed,
});

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function ActivityFeed() {
  const events = useActivity();
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("");

  const types = useMemo(
    () => Array.from(new Set(events.map((e) => e.type))).sort(),
    [events],
  );

  const filtered = useMemo(
    () =>
      events.filter((e) => {
        if (type && e.type !== type) return false;
        if (!q) return true;
        const hay = `${e.summary} ${e.moduleId} ${e.type}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      }),
    [events, q, type],
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:py-10">
      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>
            In-memory in Phase 1. Cleared on refresh. Every state change in the
            shell emits here so the audit substrate exists from day one.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-xs"
            />
            <select
              className="rounded-md border bg-background px-2 py-1 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
              aria-label="Filter by type"
            >
              <option value="">All types</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={clearActivity}>
              Clear
            </Button>
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events yet.</p>
          ) : (
            <ul className="divide-y">
              {filtered.map((e) => (
                <li key={e.id} className="flex items-start gap-3 py-2 text-sm">
                  <span className="mt-0.5 w-16 shrink-0 font-mono text-xs text-muted-foreground">
                    {formatTime(e.at)}
                  </span>
                  <Badge variant="outline" className="shrink-0">
                    {e.type}
                  </Badge>
                  <Badge variant="secondary" className="shrink-0">
                    {e.moduleId}
                  </Badge>
                  <span className="min-w-0 flex-1">{e.summary}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
