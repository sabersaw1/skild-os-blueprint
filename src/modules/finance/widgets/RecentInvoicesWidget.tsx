import { Link } from "@tanstack/react-router";
import { formatCents } from "@/core/money";
import { useInvoices } from "../hooks";

export function RecentInvoicesWidget() {
  const { data, loading } = useInvoices({ limit: 5 });

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No invoices yet.{" "}
        <Link to="/invoices/new" className="text-primary underline">
          Create one
        </Link>
        .
      </p>
    );
  }

  return (
    <ul className="space-y-2 text-sm">
      {data.map((inv) => (
        <li key={inv.id}>
          <Link
            to="/invoices/$invoiceId"
            params={{ invoiceId: inv.id }}
            className="flex items-center justify-between gap-2 hover:underline"
          >
            <span className="truncate">
              {inv.number}
              <span className="ml-2 text-xs uppercase text-muted-foreground">
                {inv.status.replace("_", " ")}
              </span>
            </span>
            <span className="whitespace-nowrap font-medium">
              {formatCents(inv.total)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
