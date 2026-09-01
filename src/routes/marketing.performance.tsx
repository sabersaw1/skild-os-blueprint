import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import {
  useServicePerformance,
  useSourcePerformance,
} from "@/modules/marketing/hooks";

export const Route = createModuleRoute("/marketing/performance")({
  moduleId: "marketing",
  head: () => ({
    meta: [
      { title: "Marketing Performance — Skild OS" },
      {
        name: "description",
        content:
          "Which sources and services actually produce qualified work, quotes, and won jobs.",
      },
      { property: "og:title", content: "Marketing Performance — Skild OS" },
      {
        property: "og:description",
        content:
          "Source-to-revenue and service-demand performance, computed from Skild's own records.",
      },
    ],
  }),
  component: MarketingPerformance,
});

function MarketingPerformance() {
  const { data: sources, loading } = useSourcePerformance();
  const { data: services } = useServicePerformance();
  const canRead = useHasCapability("marketing.read");

  if (!canRead) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        You do not have permission to view marketing performance.
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Performance</h1>
        <p className="text-xs text-muted-foreground">
          Counts only. Invoice amounts stay in Finance — nothing is duplicated
          here.
        </p>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-medium">By source</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : sources.length === 0 ? (
          <p className="text-xs text-muted-foreground">No leads recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 text-left">Source</th>
                  <th className="py-1 text-right">Leads</th>
                  <th className="py-1 text-right">Qualified</th>
                  <th className="py-1 text-right">Quoted</th>
                  <th className="py-1 text-right">Scheduled</th>
                  <th className="py-1 text-right">Won</th>
                  <th className="py-1 text-right">Invoiced</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.source} className="border-t border-border">
                    <td className="py-1">{s.source.replace(/_/g, " ")}</td>
                    <td className="py-1 text-right">{s.leads}</td>
                    <td className="py-1 text-right">{s.qualified}</td>
                    <td className="py-1 text-right">{s.quoted}</td>
                    <td className="py-1 text-right">{s.scheduled}</td>
                    <td className="py-1 text-right">{s.won}</td>
                    <td className="py-1 text-right">{s.invoiced}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">By service</h2>
        {services.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No service demand recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 text-left">Service</th>
                  <th className="py-1 text-right">Leads</th>
                  <th className="py-1 text-right">Qualified</th>
                  <th className="py-1 text-right">Quoted</th>
                  <th className="py-1 text-right">Jobs</th>
                  <th className="py-1 text-right">Won</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.service} className="border-t border-border">
                    <td className="py-1">{s.service}</td>
                    <td className="py-1 text-right">{s.leads}</td>
                    <td className="py-1 text-right">{s.qualified}</td>
                    <td className="py-1 text-right">{s.quoted}</td>
                    <td className="py-1 text-right">{s.jobs}</td>
                    <td className="py-1 text-right">{s.won}</td>
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
