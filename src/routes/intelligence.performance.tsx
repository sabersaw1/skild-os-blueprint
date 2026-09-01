import { useState } from "react";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import { formatCents } from "@/core/money";
import {
  useServicePerformanceRows,
  useSourcePerformanceRows,
  usePeriod,
} from "@/modules/intelligence/hooks";

export const Route = createModuleRoute("/intelligence/performance")({
  moduleId: "intelligence",
  head: () => ({
    meta: [
      { title: "Service & Source Performance — Skild OS" },
      {
        name: "description",
        content:
          "Which services and lead sources actually produce completed work, revenue and margin.",
      },
      { property: "og:title", content: "Service & Source Performance — Skild OS" },
      {
        property: "og:description",
        content:
          "Per-service and per-source conversion, revenue and parts cost, computed from stored records.",
      },
    ],
  }),
  component: PerformancePage,
});

function pct(v: number | null): string {
  return v === null ? "—" : `${(v * 100).toFixed(0)}%`;
}

function PerformancePage() {
  const [days, setDays] = useState(90);
  const period = usePeriod(days);
  const canRead = useHasCapability("intelligence.read");
  const { data: services, loading, error } = useServicePerformanceRows(period);
  const { data: sources } = useSourcePerformanceRows(period);

  if (!canRead) {
    return (
      <p className="text-sm text-muted-foreground">
        You do not have permission to view performance reports.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Performance</h1>
          <p className="text-xs text-muted-foreground">
            Service labels are shown exactly as recorded upstream — nothing is
            merged or renamed here.
          </p>
        </div>
        <label className="text-xs text-muted-foreground">
          Period{" "}
          <select
            className="ml-1 rounded border bg-background px-2 py-1 text-xs"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 365 days</option>
          </select>
        </label>
      </header>

      {error && <p className="text-sm text-muted-foreground">{error}</p>}

      <section>
        <h2 className="mb-2 text-sm font-medium">By service</h2>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : services.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No leads, quotes or jobs recorded in this period.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1">Service</th>
                  <th className="py-1 text-right">Leads</th>
                  <th className="py-1 text-right">Jobs</th>
                  <th className="py-1 text-right">Done</th>
                  <th className="py-1 text-right">Conv.</th>
                  <th className="py-1 text-right">Revenue</th>
                  <th className="py-1 text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.service} className="border-t">
                    <td className="py-1">{s.service}</td>
                    <td className="py-1 text-right tabular-nums">{s.leadCount}</td>
                    <td className="py-1 text-right tabular-nums">{s.jobCount}</td>
                    <td className="py-1 text-right tabular-nums">{s.completedJobCount}</td>
                    <td className="py-1 text-right tabular-nums">{pct(s.conversionRate)}</td>
                    <td className="py-1 text-right tabular-nums">
                      {formatCents(s.revenueCents)}
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {formatCents(s.grossMarginCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Margin excludes labor cost: Skild OS records a billing rate, not
              a cost rate.
            </p>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">By lead source</h2>
        {sources.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No leads recorded in this period.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1">Source</th>
                  <th className="py-1 text-right">Leads</th>
                  <th className="py-1 text-right">Qualified</th>
                  <th className="py-1 text-right">Quotes</th>
                  <th className="py-1 text-right">Jobs</th>
                  <th className="py-1 text-right">Conv.</th>
                  <th className="py-1 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.source} className="border-t">
                    <td className="py-1">{s.source}</td>
                    <td className="py-1 text-right tabular-nums">{s.leadCount}</td>
                    <td className="py-1 text-right tabular-nums">{s.qualifiedCount}</td>
                    <td className="py-1 text-right tabular-nums">{s.quoteCount}</td>
                    <td className="py-1 text-right tabular-nums">{s.jobCount}</td>
                    <td className="py-1 text-right tabular-nums">{pct(s.conversionRate)}</td>
                    <td className="py-1 text-right tabular-nums">
                      {formatCents(s.revenueCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
