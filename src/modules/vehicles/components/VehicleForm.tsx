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
import type { Customer } from "@/modules/crm/data/repository";
import type { Vehicle, VehicleCreateInput } from "../data/repository";

export function VehicleForm({
  customers,
  initial,
  lockCustomer = false,
  submitLabel = "Save",
  onSubmit,
  onCancel,
}: {
  customers: Customer[];
  initial?: Partial<Vehicle> & { customerId?: string };
  lockCustomer?: boolean;
  submitLabel?: string;
  onSubmit: (values: VehicleCreateInput) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [customerId, setCustomerId] = useState(initial?.customerId ?? "");
  const [make, setMake] = useState(initial?.make ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [year, setYear] = useState<string>(initial?.year ? String(initial.year) : "");
  const [vin, setVin] = useState(initial?.vin ?? "");
  const [licensePlate, setPlate] = useState(initial?.licensePlate ?? "");
  const [color, setColor] = useState(initial?.color ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setSaving(true);
        try {
          await onSubmit({
            customerId,
            make,
            model,
            year: year ? Number(year) : undefined,
            vin: vin || undefined,
            licensePlate: licensePlate || undefined,
            color: color || undefined,
            notes: notes || undefined,
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setSaving(false);
        }
      }}
    >
      <div>
        <Label>Customer</Label>
        <Select
          value={customerId}
          onValueChange={setCustomerId}
          disabled={lockCustomer}
        >
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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <Label htmlFor="make">Make</Label>
          <Input id="make" value={make} onChange={(e) => setMake(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="model">Model</Label>
          <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="year">Year</Label>
          <Input
            id="year"
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <Label htmlFor="vin">VIN</Label>
          <Input id="vin" value={vin} onChange={(e) => setVin(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="plate">License plate</Label>
          <Input
            id="plate"
            value={licensePlate}
            onChange={(e) => setPlate(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="color">Color</Label>
          <Input id="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
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
        <Button type="submit" disabled={saving || !customerId}>
          {saving ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
