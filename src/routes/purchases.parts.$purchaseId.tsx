import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import {
  usePartsRepository,
  usePurchase,
  usePurchaseLines,
  useSuppliers,
} from "@/modules/parts/hooks";
import { formatCents } from "@/modules/parts/data/money";
import {
  PURCHASE_STATUSES,
  type PurchaseStatus,
} from "@/modules/parts/data/schemas";

export const Route = createModuleRoute("/purchases/parts/$purchaseId")({
  moduleId: "parts",
  component: PurchaseDetail,
});

function PurchaseDetail() {
  const { purchaseId } = Route.useParams();
  const repo = usePartsRepository();
  const { data: purchase, loading } = usePurchase(purchaseId);
  const { data: lines } = usePurchaseLines(purchaseId);
  const { data: suppliers } = useSuppliers();
  const canWrite = useHasCapability("parts.purchase.write");

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  }
  if (!purchase) {
    return (
      <p className="p-6 text-sm text-muted-foreground">Purchase not found.</p>
    );
  }

  const supplier = suppliers.find((s) => s.id === purchase.supplierId);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {supplier?.name ?? "Purchase"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {purchase.orderNumber ? `Order ${purchase.orderNumber} · ` : ""}
            {new Date(
              purchase.purchasedAt ?? purchase.createdAt,
            ).toLocaleDateString()}
          </p>
          <Badge className="mt-2" variant="secondary">
            {purchase.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {canWrite && (
            <Select
              value={purchase.status}
              onValueChange={(v) =>
                void repo.updatePurchase(purchaseId, {
                  status: v as PurchaseStatus,
                })
              }
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PURCHASE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="ghost" asChild>
            <Link to="/purchases/parts">Back</Link>
          </Button>
        </div>
      </header>

      <Separator className="my-4" />

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold">Lines</h2>
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No lines recorded.</p>
        ) : (
          <ul className="space-y-2">
            {lines.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between rounded-md border p-2 text-sm"
              >
                <span className="truncate">
                  {l.description}
                  {l.partNumber ? ` · ${l.partNumber}` : ""}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {l.quantity} × {formatCents(l.unitCost)} ={" "}
                  {formatCents(l.lineTotal)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-md border p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatCents(purchase.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Shipping</span>
          <span>{formatCents(purchase.shipping)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tax</span>
          <span>{formatCents(purchase.tax)}</span>
        </div>
        <Separator className="my-2" />
        <div className="flex justify-between font-medium">
          <span>Total</span>
          <span>{formatCents(purchase.total)}</span>
        </div>
      </section>

      {purchase.notes && (
        <p className="mt-4 whitespace-pre-wrap text-sm">{purchase.notes}</p>
      )}
    </div>
  );
}
