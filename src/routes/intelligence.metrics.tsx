import { useState } from "react";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import { Button } from "@/components/ui/button";
import {
  useIntelligenceRepository,
  useMetricSnapshots,
  usePeriod,
} from "@/modules/intelligence/hooks";
import { formatMetric } from "./intelligence.index";

export const Route = createModuleRoute("/intelligence/metrics")({
  moduleId: "intelligence",
  head: () => ({
    meta: [
      { title: "Metric Snapshots — Skild OS" },
      {
        name: "description",
        content:
          "Immutable metric snapshots recording what the numbers were at the moment they were captured.",
      },
      { property: "og:title", content: "Metric Snapshots — Skild OS" },
      {
        property: "og:description",
        content:
          "A permanent, append-only history of business metrics captured from Skild OS records.",
      },
    ],
  }),
  component: MetricsPage,
});

function MetricsPage() {
  const repo = useIntelligenceRepository();
  const period = usePeriod(30);
  const canRead = useHasCapability("intelligence.read");
  const canCalculate = useHasCapability("intelligence.calculate");
  const { data: snapshots, loading, error, refresh } = useMetricSnapshots(100);
  const [busy, setBusy] = useState(false);
  const [captureError, setCaptureError] = useState<string | undefined>();

  async function capture() {
    setBusy(true);
    setCaptureError(undefined);
    try {
      await repo.captureSnapshots(period);
      refresh();
    } catch (e) {
      setCaptureError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!canRead) {
    return (
      <p className="text-sm text-muted-foreground">
        You do not have permission to view metric snapshots.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Metric snapshots</h1>
          <p className="text-xs text-muted-foreground">
            Snapshots are append-only. An existing snapshot is never rewritten,
            so history stays truthful even when the underlying records change.
          </p>
        </div>
        {canCalculate && (
          <Button size="sm" onClick={capture} disabled={busy}>
            {busy ? "Capturing…" : "Capture snapshot"}
          </Button>
        )}
      </header>

      {(error || captureError) && (
        <p className="text-sm text-destructive">{error ?? captureError}</p>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : snapshots.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No snapshots captured yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1">Captured</th>
                <th className="py-1">Metric</th>
                <th className="py-1 text-right">Value</th>
                <th className="py-1">Completeness</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="py-1 text-xs text-muted-foreground">
                    {new Date(s.capturedAt).toLocaleString()}
                  </td>
                  <td className="py-1">{s.metricId}</td>
                  <td className="py-1 text-right tabular-nums">
                    {formatMetric(s.value, s.unit)}
                  </td>
                  <td className="py-1 text-xs text-muted-foreground">
                    {s.completeness}
                    {s.limitation ? ` — ${s.limitation}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
