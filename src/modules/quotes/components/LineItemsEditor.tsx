import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import {
  LINE_ITEM_CATEGORIES,
  type LineItemInput,
} from "../data/schemas";
import { computeTotals, lineTotal } from "../data/totals";

const money = (n: number) =>
  n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

export function LineItemsEditor({
  items,
  discount,
  tax,
  onItemsChange,
  onDiscountChange,
  onTaxChange,
}: {
  items: LineItemInput[];
  discount: number;
  tax: number;
  onItemsChange: (next: LineItemInput[]) => void;
  onDiscountChange: (n: number) => void;
  onTaxChange: (n: number) => void;
}) {
  const totals = computeTotals(items, discount, tax);

  const update = (idx: number, patch: Partial<LineItemInput>) => {
    onItemsChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const remove = (idx: number) => {
    onItemsChange(items.filter((_, i) => i !== idx));
  };
  const add = () => {
    onItemsChange([
      ...items,
      { description: "", category: "labor", quantity: 1, unitPrice: 0 },
    ]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Line items</Label>
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add item
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
          No line items yet. Add labor, parts, or fees.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((it, idx) => (
            <li
              key={idx}
              className="grid grid-cols-12 gap-2 rounded-md border border-border bg-card p-2"
            >
              <Input
                className="col-span-12 sm:col-span-5"
                placeholder="Description"
                value={it.description}
                onChange={(e) => update(idx, { description: e.target.value })}
              />
              <Select
                value={it.category}
                onValueChange={(v) =>
                  update(idx, { category: v as LineItemInput["category"] })
                }
              >
                <SelectTrigger className="col-span-6 sm:col-span-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINE_ITEM_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="col-span-3 sm:col-span-1"
                type="number"
                min={0}
                step="0.01"
                value={it.quantity}
                onChange={(e) =>
                  update(idx, { quantity: Number(e.target.value) })
                }
                aria-label="Quantity"
              />
              <Input
                className="col-span-3 sm:col-span-2"
                type="number"
                min={0}
                step="0.01"
                value={it.unitPrice}
                onChange={(e) =>
                  update(idx, { unitPrice: Number(e.target.value) })
                }
                aria-label="Unit price"
              />
              <div className="col-span-4 sm:col-span-1 flex items-center justify-end text-sm">
                {money(lineTotal(it))}
              </div>
              <div className="col-span-2 sm:col-span-1 flex items-center justify-end">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => remove(idx)}
                  aria-label="Remove line item"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {it.category === "part" && (
                <Input
                  className="col-span-12 sm:col-span-6 sm:col-start-1"
                  placeholder="Part reference (SKU)"
                  value={it.partReference ?? ""}
                  onChange={(e) =>
                    update(idx, { partReference: e.target.value })
                  }
                />
              )}
              {it.category === "labor" && (
                <div className="col-span-12 sm:col-span-6 sm:col-start-1 flex items-center gap-2">
                  <Label
                    htmlFor={`labor-${idx}`}
                    className="text-xs text-muted-foreground"
                  >
                    Labor hours
                  </Label>
                  <Input
                    id={`labor-${idx}`}
                    className="max-w-[8rem]"
                    type="number"
                    min={0}
                    step="0.25"
                    value={it.laborHours ?? ""}
                    onChange={(e) =>
                      update(idx, {
                        laborHours: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
                    }
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-2 sm:max-w-sm sm:ml-auto">
        <Label htmlFor="q-discount" className="self-center">
          Discount
        </Label>
        <Input
          id="q-discount"
          type="number"
          min={0}
          step="0.01"
          value={discount}
          onChange={(e) => onDiscountChange(Number(e.target.value) || 0)}
        />
        <Label htmlFor="q-tax" className="self-center">
          Tax
        </Label>
        <Input
          id="q-tax"
          type="number"
          min={0}
          step="0.01"
          value={tax}
          onChange={(e) => onTaxChange(Number(e.target.value) || 0)}
        />
      </div>

      <dl className="ml-auto grid max-w-sm grid-cols-2 gap-1 text-sm">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd className="text-right">{money(totals.subtotal)}</dd>
        <dt className="text-muted-foreground">Discount</dt>
        <dd className="text-right">−{money(totals.discount)}</dd>
        <dt className="text-muted-foreground">Tax</dt>
        <dd className="text-right">{money(totals.tax)}</dd>
        <dt className="font-semibold">Total</dt>
        <dd className="text-right font-semibold">{money(totals.total)}</dd>
      </dl>
    </div>
  );
}
