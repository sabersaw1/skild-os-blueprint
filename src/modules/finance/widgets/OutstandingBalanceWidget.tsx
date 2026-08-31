import { formatCents } from "@/core/money";
import { useInvoices } from "../hooks";

export function OutstandingBalanceWidget() {
  const { data, loading } = useInvoices({ outstandingOnly: true });

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const outstanding = data.reduce((sum, i) => sum + i.balance, 0);
  const overdue = data
    .filter((i) => i.dueAt !== undefined && i.dueAt < Date.now())
    .reduce((sum, i) => sum + i.balance, 0);

  return (
    <dl className="space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <dt className="text-muted-foreground">Outstanding</dt>
        <dd className="font-medium">{formatCents(outstanding)}</dd>
      </div>
      <div className="flex items-center justify-between">
        <dt className="text-muted-foreground">Overdue</dt>
        <dd className="font-medium">{formatCents(overdue)}</dd>
      </div>
      <div className="flex items-center justify-between">
        <dt className="text-muted-foreground">Open invoices</dt>
        <dd className="font-medium">{data.length}</dd>
      </div>
    </dl>
  );
}
