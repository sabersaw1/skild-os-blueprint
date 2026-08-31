import { useState } from "react";
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
import { toCents } from "../data/money";
import type { CreatePartUsageInput } from "../data/schemas";

export interface UsageVehicleOption {
  id: string;
  label: string;
}
export interface UsageJobOption {
  id: string;
  label: string;
}

export function PartUsageForm({
  partId,
  vehicles,
  jobs,
  onSubmit,
}: {
  partId: string;
  vehicles: UsageVehicleOption[];
  jobs: UsageJobOption[];
  onSubmit: (input: CreatePartUsageInput) => Promise<void> | void;
}) {
  const [vehicleId, setVehicleId] = useState("");
  const [jobId, setJobId] = useState("none");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
          await onSubmit({
            partId,
            vehicleId,
            jobId: jobId === "none" ? undefined : jobId,
            quantity: Number(quantity),
            unitCost: toCents(unitCost),
            notes: notes.trim() || undefined,
          });
          setQuantity("1");
          setUnitCost("");
          setNotes("");
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Could not record usage.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="usage-vehicle">Vehicle</Label>
          <Select value={vehicleId} onValueChange={setVehicleId}>
            <SelectTrigger id="usage-vehicle">
              <SelectValue placeholder="Select vehicle" />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="usage-job">Job (optional)</Label>
          <Select value={jobId} onValueChange={setJobId}>
            <SelectTrigger id="usage-job">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {jobs.map((j) => (
                <SelectItem key={j.id} value={j.id}>
                  {j.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="usage-qty">Quantity</Label>
          <Input
            id="usage-qty"
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="usage-cost">Unit cost (USD)</Label>
          <Input
            id="usage-cost"
            type="number"
            min="0"
            step="0.01"
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="usage-notes">Notes</Label>
          <Input
            id="usage-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy || !vehicleId}>
        {busy ? "Recording…" : "Record usage"}
      </Button>
    </form>
  );
}
