import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import { usePartsRepository, useSuppliers } from "@/modules/parts/hooks";
import { formatCents, toCents } from "@/modules/parts/data/money";
import {
  PurchaseLinesEditor,
  draftLineTotalCents,
  emptyDraftLine,
  type DraftLine,
} from "@/modules/parts/components/PurchaseLinesEditor";
import {
  PURCHASE_STATUSES,
  type PurchaseStatus,
} from "@/modules/parts/data/schemas";

export const Route = createModuleRoute("/purchases/parts/new")({
  moduleId: "parts",
  component: NewPurchase,
});

function NewPurchase() {
  const navigate = useNavigate();
  const repo = usePartsRepository();
  const { data: suppliers } = useSuppliers();
  const canWrite = useHasCapability("parts.purchase.write");

  const [supplierId, setSupplierId] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [status, setStatus] = useState<PurchaseStatus>("ordered");
  const [shipping, setShipping] = useState("");
  const [tax, setTax] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([emptyDraftLine()]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!canWrite) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        You do not have permission to record purchases.
      </p>
    );
  }

  const subtotal = lines.reduce((s, l) => s + draftLineTotalCents(l), 0);
  const total = subtotal + toCents(shipping) + toCents(tax);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">
        New parts purchase
      </h1>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setBusy(true);
          try {
            const purchase = await repo.createPurchase({
              supplierId,
              orderNumber: orderNumber.trim() || undefined,
              status,
              purchasedAt: Date.now(),
              shipping: toCents(shipping),
              tax: toCents(tax),
              notes: notes.trim() || undefined,
              lines: lines
                .filter((l) => l.description.trim())
                .map((l) => ({
                  description: l.description.trim(),
                  partNumber: l.partNumber.trim() || undefined,
                  quantity: Number(l.quantity),
                  unitCost: toCents(l.unitCost),
                })),
            });
            navigate({
              to: "/purchases/parts/$purchaseId",
              params: { purchaseId: purchase.id },
            });
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Could not create purchase.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="supplier">Supplier</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger id="supplier">
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="order">Order number</Label>
            <Input
              id="order"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as PurchaseStatus)}
            >
              <SelectTrigger id="status">
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="shipping">Shipping (USD)</Label>
            <Input
              id="shipping"
              type="number"
              min="0"
              step="0.01"
              value={shipping}
              onChange={(e) => setShipping(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tax">Tax (USD)</Label>
            <Input
              id="tax"
              type="number"
              min="0"
              step="0.01"
              value={tax}
              onChange={(e) => setTax(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <PurchaseLinesEditor lines={lines} onChange={setLines} />

        <div className="rounded-md border p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCents(subtotal)}</span>
          </div>
          <div className="mt-1 flex justify-between font-medium">
            <span>Total</span>
            <span>{formatCents(total)}</span>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button type="submit" disabled={busy || !supplierId}>
            {busy ? "Saving…" : "Create purchase"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: "/purchases/parts" })}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
