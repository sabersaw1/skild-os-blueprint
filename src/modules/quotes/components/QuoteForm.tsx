import { useMemo, useState } from "react";
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
import type { Customer } from "@/modules/crm/data/repository";
import type { Vehicle } from "@/modules/vehicles/data/repository";
import type { Inspection } from "@/modules/inspections/data/schemas";
import type { LineItemInput } from "../data/schemas";
import { LineItemsEditor } from "./LineItemsEditor";

export interface QuoteFormValues {
  customerId: string;
  vehicleId: string;
  inspectionId?: string;
  title: string;
  lineItems: LineItemInput[];
  discount: number;
  tax: number;
  notes: string;
}

export function QuoteForm({
  vehicles,
  customers,
  inspections,
  initial,
  requireChangeReason = false,
  submitLabel = "Create",
  onSubmit,
  onCancel,
}: {
  vehicles: Vehicle[];
  customers: Customer[];
  inspections: Inspection[];
  initial?: Partial<QuoteFormValues>;
  requireChangeReason?: boolean;
  submitLabel?: string;
  onSubmit: (
    values: QuoteFormValues,
    changeReason: string,
  ) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [vehicleId, setVehicleId] = useState(initial?.vehicleId ?? "");
  const [customerId, setCustomerId] = useState(initial?.customerId ?? "");
  const [inspectionId, setInspectionId] = useState(initial?.inspectionId ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [lineItems, setLineItems] = useState<LineItemInput[]>(
    initial?.lineItems ?? [],
  );
  const [discount, setDiscount] = useState<number>(initial?.discount ?? 0);
  const [tax, setTax] = useState<number>(initial?.tax ?? 0);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [changeReason, setChangeReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const vehicleOptions = useMemo(
    () =>
      vehicles.map((v) => {
        const owner = customers.find((c) => c.id === v.customerId);
        return {
          id: v.id,
          customerId: v.customerId,
          label:
            `${v.year ? `${v.year} ` : ""}${v.make} ${v.model}` +
            (owner ? ` — ${owner.displayName}` : ""),
        };
      }),
    [vehicles, customers],
  );

  const filteredInspections = useMemo(
    () =>
      vehicleId
        ? inspections.filter((i) => i.vehicleId === vehicleId)
        : inspections,
    [inspections, vehicleId],
  );

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const chosen = vehicleOptions.find((v) => v.id === vehicleId);
        if (!chosen) {
          setError("Select a vehicle.");
          return;
        }
        const effectiveCustomerId = customerId || chosen.customerId;
        if (!effectiveCustomerId) {
          setError("Select a customer.");
          return;
        }
        if (!title.trim()) {
          setError("Title is required.");
          return;
        }
        if (requireChangeReason && !changeReason.trim()) {
          setError("A change reason is required.");
          return;
        }
        setSaving(true);
        try {
          await onSubmit(
            {
              customerId: effectiveCustomerId,
              vehicleId,
              inspectionId: inspectionId || undefined,
              title: title.trim(),
              lineItems,
              discount,
              tax,
              notes,
            },
            changeReason.trim(),
          );
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="mb-2 block">Vehicle</Label>
          <Select
            value={vehicleId}
            onValueChange={(v) => {
              setVehicleId(v);
              const veh = vehicleOptions.find((o) => o.id === v);
              if (veh && !customerId) setCustomerId(veh.customerId);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a vehicle" />
            </SelectTrigger>
            <SelectContent>
              {vehicleOptions.length === 0 ? (
                <div className="px-2 py-1 text-xs text-muted-foreground">
                  No vehicles registered yet.
                </div>
              ) : (
                vehicleOptions.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-2 block">Customer</Label>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a customer" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="q-title">Title</Label>
        <Input
          id="q-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Front brake replacement"
        />
      </div>

      <div>
        <Label className="mb-2 block">Reference inspection (optional)</Label>
        <Select
          value={inspectionId || "none"}
          onValueChange={(v) => setInspectionId(v === "none" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No inspection</SelectItem>
            {filteredInspections.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                Inspection · {i.status} · {i.findings.length} finding
                {i.findings.length === 1 ? "" : "s"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <LineItemsEditor
        items={lineItems}
        discount={discount}
        tax={tax}
        onItemsChange={setLineItems}
        onDiscountChange={setDiscount}
        onTaxChange={setTax}
      />

      <div>
        <Label htmlFor="q-notes">Notes</Label>
        <Textarea
          id="q-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </div>

      {requireChangeReason && (
        <div>
          <Label htmlFor="q-reason">Change reason</Label>
          <Input
            id="q-reason"
            value={changeReason}
            onChange={(e) => setChangeReason(e.target.value)}
            placeholder="Why is this quote being revised?"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            A new immutable version will be recorded.
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={saving || !vehicleId || !title}>
          {saving ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
