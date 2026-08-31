import { usePartUsage, usePurchases } from "../hooks";
import { formatCents } from "../data/money";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export function PartsCostWidget() {
  const since = Date.now() - THIRTY_DAYS;
  const { data: purchases, loading } = usePurchases({ from: since });
  const { data: usage } = usePartUsage({ from: since });

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const purchased = purchases
    .filter((p) => p.status !== "cancelled" && p.status !== "returned")
    .reduce((sum, p) => sum + p.total, 0);
  const used = usage.reduce((sum, u) => sum + u.totalCost, 0);
  const usedOnJobs = usage
    .filter((u) => u.jobId)
    .reduce((sum, u) => sum + u.totalCost, 0);

  return (
    <dl className="space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <dt className="text-muted-foreground">Purchased (30d)</dt>
        <dd className="font-medium">{formatCents(purchased)}</dd>
      </div>
      <div className="flex items-center justify-between">
        <dt className="text-muted-foreground">Parts used (30d)</dt>
        <dd className="font-medium">{formatCents(used)}</dd>
      </div>
      <div className="flex items-center justify-between">
        <dt className="text-muted-foreground">Used on jobs</dt>
        <dd className="font-medium">{formatCents(usedOnJobs)}</dd>
      </div>
    </dl>
  );
}
