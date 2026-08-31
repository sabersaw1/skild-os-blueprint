import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCents, lineTotalCents, toCents, toDollars } from "@/core/money";
import {
  INVOICE_LINE_CATEGORIES,
  type InvoiceLineInput,
} from "../data/schemas";

export function InvoiceLinesEditor({
  value,
  onChange,
}: {
  value: InvoiceLineInput[];
  onChange: (next: InvoiceLineInput[]) => void;
}) {
  const patch = (i: number, next: Partial<InvoiceLineInput>) =>
    onChange(value.map((l, idx) => (idx === i ? { ...l, ...next } : l)));

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="text-xs text-muted-foreground">No lines yet.</p>
      )}
      {value.map((line, i) => (
        <div
          key={i}
          className="grid grid-cols-12 items-end gap-2 rounded-md border border-border p-2"
        >
          <label className="col-span-12 sm:col-span-4 text-xs">
            Description
            <Input
              value={line.description}
              onChange={(e) => patch(i, { description: e.target.value })}
              placeholder="Front brake pads"
            />
          </label>
          <label className="col-span-6 sm:col-span-2 text-xs">
            Category
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={line.category ?? "other"}
              onChange={(e) =>
                patch(i, {
                  category: e.target.value as InvoiceLineInput["category"],
                })
              }
            >
              {INVOICE_LINE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-6 sm:col-span-2 text-xs">
            Qty
            <Input
              type="number"
              min="0"
              step="0.25"
              value={line.quantity}
              onChange={(e) => patch(i, { quantity: Number(e.target.value) })}
            />
          </label>
          <label className="col-span-6 sm:col-span-2 text-xs">
            Unit price ($)
            <Input
              type="number"
              min="0"
              step="0.01"
              value={toDollars(line.unitPrice)}
              onChange={(e) => patch(i, { unitPrice: toCents(e.target.value) })}
            />
          </label>
          <div className="col-span-4 sm:col-span-1 text-right text-xs">
            <span className="block text-muted-foreground">Total</span>
            <span className="font-medium">
              {formatCents(lineTotalCents(line.quantity, line.unitPrice))}
            </span>
          </div>
          <div className="col-span-2 sm:col-span-1 flex justify-end">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Remove line"
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange([
            ...value,
            { description: "", category: "labor", quantity: 1, unitPrice: 0 },
          ])
        }
      >
        <Plus className="mr-1 h-4 w-4" /> Add line
      </Button>
    </div>
  );
}
