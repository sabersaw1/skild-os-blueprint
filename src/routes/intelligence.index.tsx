import { useState } from "react";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import { formatCents } from "@/core/money";
import {
  useIntelligenceComparison,
  useIntelligenceOverview,
  usePeriod,
} from "@/modules/intelligence/hooks";
import type { MetricComputation, MetricUnit } from "@/modules/intelligence/data/schemas";

export const Route = createModuleRoute("/intelligence/")({
  moduleId: "intelligence",
  head: () => ({
    meta: [
      { title: "Business Intelligence — Skild OS" },
      {
        name: "description",
        content:
          "What is actually happening in the shop: funnel, profitability and metrics computed from Skild's own records.",
      },
      { property: "og:title", content: "Business Intelligence — Skild OS" },
      {
        property: "og:description",
        content:
          "Grounded business metrics, funnel conversion and profitability — no estimates, no invented baselines.",
      },
    ],
  }),
  component: IntelligenceOverviewPage,
});

const HEADLINE_METRICS = [
  "lead_count",
  "lead_conversion_rate",
  "quote_conversion_rate",
  "job_completed_count",
  "invoiced_revenue",
  "collected_revenue",
  "outstanding_balance",
  "gross_margin",
];

export function formatMetric(value: number, unit: MetricUnit): string {
  switch (unit) {
    case "cents":
      return formatCents(value);
    case "ratio":
      return `${(value * 100).toFixed(1)}%`;
    case "hours":
      return `${value.toFixed(1)} h`;
    case "days":
      return `${value.toFixed(1)} d`;
    case "ms":
      return value === 0 ? "—" : `${(value / 3_600_000).toFixed(1)} h`;
    default:
      return String(value);
  }
}

function MetricCard({ m, name }: { m: MetricComputation; name: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{name}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">
        {formatMetric(m.value, m.unit)}
      </div>
      {m.completeness !== "complete" && (
        <div className="mt-1 text-[11px] text-muted-foreground">
          {m.completeness === "unavailable"
            ? "No source data"
            : "Partial data"}
          {m.limitation ? ` — ${m.limitation}` : ""}
        </div>
      )}
    </div>
  );
}

function IntelligenceOverviewPage() {
  const [days, setDays] = useState(30);
  const period = usePeriod(days);
  const canRead = useHasCapability("intelligence.read");
  const { data: overview, loading, error } = useIntelligenceOverview(period);
  const { data: comparison } = useIntelligenceComparison(period);

  if (!canRead) {
    return (
      <p className="text-sm text-muted-foreground">
        You do not have permission to view business intelligence.
      </p>
    );
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error) return <p className="text-sm text-muted-foreground">{error}</p>;
  if (!overview) return null;

  const names = new Map(
    (comparison?.rows ?? []).map((r) => [r.metricId, r.name] as const),
  );
  const headline = overview.metrics.filter((m) => HEADLINE_METRICS.includes(m.metricId));
  const p = overview.profitability;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Business Intelligence
          </h1>
          <p className="text-xs text-muted-foreground">
            Every figure below is computed from records Skild OS already
            holds. Nothing is estimated.
          </p>
        </div>
        <label className="text-xs text-muted-foreground">
          Period{" "}
          <select
            className="ml-1 rounded border bg-background px-2 py-1 text-xs"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 365 days</option>
          </select>
        </label>
      </header>

      {overview.unavailableModules.length > 0 && (
        <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          These modules were unavailable, so figures depending on them are
          incomplete: {overview.unavailableModules.join(", ")}.
        </p>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium">Headline metrics</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {headline.map((m) => (
            <MetricCard key={m.metricId} m={m} name={names.get(m.metricId) ?? m.metricId} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">Compared with the previous period</h2>
        {!comparison ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : !comparison.baselineAvailable ? (
          <p className="text-xs text-muted-foreground">
            No baseline yet — the preceding period holds no records, so no
            trend can be calculated. Skild OS will not invent one.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1">Metric</th>
                  <th className="py-1 text-right">Now</th>
                  <th className="py-1 text-right">Previous</th>
                  <th className="py-1 text-right">Change</th>
                </tr>
              </thead>
              <tbody>
                {comparison.rows
                  .filter((r) => HEADLINE_METRICS.includes(r.metricId))
                  .map((r) => (
                    <tr key={r.metricId} className="border-t">
                      <td className="py-1">{r.name}</td>
                      <td className="py-1 text-right tabular-nums">
                        {formatMetric(r.currentValue, r.unit)}
                      </td>
                      <td className="py-1 text-right tabular-nums">
                        {r.previousValue === null
                          ? "—"
                          : formatMetric(r.previousValue, r.unit)}
                      </td>
                      <td className="py-1 text-right tabular-nums">
                        {r.changeRatio === null
                          ? "—"
                          : `${r.changeRatio > 0 ? "+" : ""}${(r.changeRatio * 100).toFixed(1)}%`}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">Funnel</h2>
        {overview.funnel.stages.every((s) => s.count === 0) ? (
          <p className="text-xs text-muted-foreground">
            No leads, quotes or jobs exist in this period, so there is no
            funnel to measure.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {overview.funnel.stages.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3">
                <span>{s.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {s.id === "revenue"
                    ? formatCents(overview.funnel.revenueCents)
                    : s.count}
                  {s.conversionFromPrevious !== null && s.id !== "revenue"
                    ? ` (${(s.conversionFromPrevious * 100).toFixed(0)}%)`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        {overview.funnel.limitations.map((l) => (
          <p key={l} className="mt-1 text-[11px] text-muted-foreground">
            {l}
          </p>
        ))}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">Profitability</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Invoiced</dt>
            <dd className="tabular-nums">{formatCents(p.revenueCents)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Collected</dt>
            <dd className="tabular-nums">{formatCents(p.collectedCents)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Outstanding</dt>
            <dd className="tabular-nums">{formatCents(p.outstandingCents)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Parts cost</dt>
            <dd className="tabular-nums">{formatCents(p.partsCostCents)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Labor billed</dt>
            <dd className="tabular-nums">{formatCents(p.laborRevenueCents)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Gross margin</dt>
            <dd className="tabular-nums">{formatCents(p.grossMarginCents)}</dd>
          </div>
        </dl>
        {p.limitations.map((l) => (
          <p key={l} className="mt-1 text-[11px] text-muted-foreground">
            {l}
          </p>
        ))}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">Needs attention</h2>
        {overview.attention.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nothing is overdue in the records Skild OS holds.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {overview.attention.slice(0, 10).map((a) => (
              <li key={a.id}>
                <div className="font-medium">{a.title}</div>
                <div className="text-xs text-muted-foreground">
                  {a.detail}
                  {a.amountCents !== undefined
                    ? ` · ${formatCents(a.amountCents)}`
                    : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
