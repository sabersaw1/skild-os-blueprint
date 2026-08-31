import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCents, toCents } from "../data/money";

export interface DraftLine {
  description: string;
  partNumber: string;
  quantity: string;
  unitCost: string;
  vehicleId: string;
}

export function emptyDraftLine(): DraftLine {
  return {
    description: "",
    partNumber: "",
    quantity: "1",
    unitCost: "",
    vehicleId: "",
  };
}

export function draftLineTotalCents(line: DraftLine): number {
  const qty = Number(line.quantity);
  if (!Number.isFinite(qty)) return 0;
  return Math.round(qty * toCents(line.unitCost));
}

export function PurchaseLinesEditor({
  lines,
  onChange,
}: {
  lines: DraftLine[];
  onChange: (next: DraftLine[]) => void;
}) {
  const update = (i: number, patch: Partial<DraftLine>) =>
    onChange(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Purchase lines</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange([...lines, emptyDraftLine()])}
        >
          Add line
        </Button>
      </div>

      {lines.length === 0 && (
        <p className="text-sm text-muted-foreground">No lines yet.</p>
      )}

      {lines.map((line, i) => (
        <div key={i} className="rounded-md border p-3">
          <div className="grid gap-2 sm:grid-cols-6">
            <Input
              className="sm:col-span-3"
              placeholder="Description"
              value={line.description}
              onChange={(e) => update(i, { description: e.target.value })}
              required
            />
            <Input
              placeholder="Part #"
              value={line.partNumber}
              onChange={(e) => update(i, { partNumber: e.target.value })}
            />
            <Input
              type="number"
              min="1"
              step="1"
              placeholder="Qty"
              value={line.quantity}
              onChange={(e) => update(i, { quantity: e.target.value })}
              required
            />
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Unit $"
              value={line.unitCost}
              onChange={(e) => update(i, { unitCost: e.target.value })}
              required
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Line total {formatCents(draftLineTotalCents(line))}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onChange(lines.filter((_, idx) => idx !== i))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
