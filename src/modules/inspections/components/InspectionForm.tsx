import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
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
import type {
  InspectionCreateInput,
  InspectionTemplate,
} from "../data/schemas";

export function InspectionForm({
  vehicles,
  customers,
  templates,
  initial,
  submitLabel = "Create",
  onSubmit,
  onCancel,
}: {
  vehicles: Vehicle[];
  customers: Customer[];
  templates: InspectionTemplate[];
  initial?: Partial<InspectionCreateInput>;
  submitLabel?: string;
  onSubmit: (values: InspectionCreateInput) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [vehicleId, setVehicleId] = useState(initial?.vehicleId ?? "");
  const [templateId, setTemplateId] = useState<string>(initial?.templateId ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
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
        setSaving(true);
        try {
          await onSubmit({
            vehicleId,
            customerId: chosen.customerId,
            templateId: templateId || undefined,
            notes,
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setSaving(false);
        }
      }}
    >
      <div>
        <Label className="mb-2 block">Vehicle</Label>
        <Select value={vehicleId} onValueChange={setVehicleId}>
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
        <Label className="mb-2 block">Template (optional)</Label>
        <Select
          value={templateId || "none"}
          onValueChange={(v) => setTemplateId(v === "none" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No template</SelectItem>
            {templates.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="i-notes">Notes</Label>
        <Textarea
          id="i-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Anything the technician should know before starting."
        />
      </div>

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
        <Button type="submit" disabled={saving || !vehicleId}>
          {saving ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
