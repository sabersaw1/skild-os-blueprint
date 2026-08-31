import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import { usePurchases, useSuppliers } from "@/modules/parts/hooks";
import { formatCents } from "@/modules/parts/data/money";
import {
  PURCHASE_STATUSES,
  type PurchaseStatus,
} from "@/modules/parts/data/schemas";

export const Route = createModuleRoute("/purchases/parts/")({
  moduleId: "parts",
  component: PurchasesIndex,
});

function PurchasesIndex() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<PurchaseStatus | "all">("all");
  const [supplierId, setSupplierId] = useState("all");
  const [search, setSearch] = useState("");

  const query = useMemo(
    () => ({
      status: status === "all" ? undefined : status,
      supplierId: supplierId === "all" ? undefined : supplierId,
      search: search || undefined,
    }),
    [status, supplierId, search],
  );

  const { data, loading } = usePurchases(query);
  const { data: suppliers } = useSuppliers();
  const canWrite = useHasCapability("parts.purchase.write");

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Parts purchases
          </h1>
          <p className="text-xs text-muted-foreground">
            {data.length} purchase{data.length === 1 ? "" : "s"} ·{" "}
            <Link to="/parts" className="text-primary underline">
              Parts catalog
            </Link>
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => navigate({ to: "/purchases/parts/new" })}>
            <Plus className="mr-1 h-4 w-4" /> New purchase
          </Button>
        )}
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search order number or notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={supplierId} onValueChange={setSupplierId}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All suppliers</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as typeof status)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {PURCHASE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No purchases found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((p) => (
            <Link
              key={p.id}
              to="/purchases/parts/$purchaseId"
              params={{ purchaseId: p.id }}
              className="block rounded-md border p-3 transition-colors hover:bg-accent"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {suppliers.find((s) => s.id === p.supplierId)?.name ??
                      "Supplier"}
                    {p.orderNumber ? ` · ${p.orderNumber}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.purchasedAt ?? p.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge variant="secondary">{p.status}</Badge>
                  <p className="mt-1 text-sm font-medium">
                    {formatCents(p.total)}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
