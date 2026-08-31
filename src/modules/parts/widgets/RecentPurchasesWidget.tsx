import { Link } from "@tanstack/react-router";
import { usePurchases, useSuppliers } from "../hooks";
import { formatCents } from "../data/money";

export function RecentPurchasesWidget() {
  const { data, loading } = usePurchases({ limit: 5 });
  const { data: suppliers } = useSuppliers();

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No purchases yet.{" "}
        <Link to="/purchases/parts/new" className="text-primary underline">
          Record one
        </Link>
        .
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {data.map((p) => (
        <li key={p.id} className="text-sm">
          <Link
            to="/purchases/parts/$purchaseId"
            params={{ purchaseId: p.id }}
            className="flex items-center justify-between gap-2 hover:underline"
          >
            <span className="truncate">
              {suppliers.find((s) => s.id === p.supplierId)?.name ?? "Supplier"}
              {p.orderNumber ? ` · ${p.orderNumber}` : ""}
            </span>
            <span className="shrink-0 text-muted-foreground">
              {p.status} · {formatCents(p.total)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
