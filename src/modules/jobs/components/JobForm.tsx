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
import type { Quote } from "@/modules/quotes/data/schemas";
import {
  JOB_PRIORITIES,
  type JobPriority,
} from "../data/schemas";

export interface JobFormValues {
  customerId: string;
  vehicleId: string;
  quoteId?: string;
  inspectionId?: string;
  title: string;
  description: string;
  priority: JobPriority;
  scheduledStart?: number;
  scheduledEnd?: number;
  assignedTo?: string;
  notes: string;
}

// Local <-> "datetime-local" helpers (yyyy-MM-ddTHH:mm).
function toLocalInput(ms: number | undefined): string {
  if (!ms) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}
function fromLocalInput(s: string): number | undefined {
  if (!s) return undefined;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : undefined;
}

export function JobForm({
  vehicles,
  customers,
  inspections,
  quotes,
  initial,
  submitLabel = "Create",
  onSubmit,
  onCancel,
}: {
  vehicles: Vehicle[];
  customers: Customer[];
  inspections: Inspection[];
  quotes: Quote[];
  initial?: Partial<JobFormValues>;
  submitLabel?: string;
  onSubmit: (values: JobFormValues) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [vehicleId, setVehicleId] = useState(initial?.vehicleId ?? "");
  const [customerId, setCustomerId] = useState(initial?.customerId ?? "");
  const [quoteId, setQuoteId] = useState(initial?.quoteId ?? "");
  const [inspectionId, setInspectionId] = useState(
    initial?.inspectionId ?? "",
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priority, setPriority] = useState<JobPriority>(
    initial?.priority ?? "normal",
  );
  const [scheduledStart, setScheduledStart] = useState<string>(
    toLocalInput(initial?.scheduledStart),
  );
  const [scheduledEnd, setScheduledEnd] = useState<string>(
    toLocalInput(initial?.scheduledEnd),
  );
  const [assignedTo, setAssignedTo] = useState(initial?.assignedTo ?? "");
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

  const filteredInspections = useMemo(
    () =>
      vehicleId
        ? inspections.filter((i) => i.vehicleId === vehicleId)
        : inspections,
    [inspections, vehicleId],
  );

  const filteredQuotes = useMemo(
    () =>
      vehicleId ? quotes.filter((q) => q.vehicleId === vehicleId) : quotes,
    [quotes, vehicleId],
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
        const start = fromLocalInput(scheduledStart);
        const end = fromLocalInput(scheduledEnd);
        if (start != null && end != null && end < start) {
          setError("Scheduled end must be after start.");
          return;
        }
        setSaving(true);
        try {
          await onSubmit({
            customerId: effectiveCustomerId,
            vehicleId,
            quoteId: quoteId || undefined,
            inspectionId: inspectionId || undefined,
            title: title.trim(),
            description: description.trim(),
            priority,
            scheduledStart: start,
            scheduledEnd: end,
            assignedTo: assignedTo.trim() || undefined,
            notes,
          });
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
        <Label htmlFor="job-title">Title</Label>
        <Input
          id="job-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Replace front rotors"
        />
      </div>

      <div>
        <Label htmlFor="job-desc">Description</Label>
        <Textarea
          id="job-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="mb-2 block">Priority</Label>
          <Select
            value={priority}
            onValueChange={(v) => setPriority(v as JobPriority)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {JOB_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="job-assign">Assigned to (optional)</Label>
          <Input
            id="job-assign"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            placeholder="Technician name or id"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="job-start">Scheduled start</Label>
          <Input
            id="job-start"
            type="datetime-local"
            value={scheduledStart}
            onChange={(e) => setScheduledStart(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="job-end">Scheduled end</Label>
          <Input
            id="job-end"
            type="datetime-local"
            value={scheduledEnd}
            onChange={(e) => setScheduledEnd(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="mb-2 block">Link quote (optional)</Label>
          <Select
            value={quoteId || "none"}
            onValueChange={(v) => setQuoteId(v === "none" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No quote</SelectItem>
              {filteredQuotes.map((q) => (
                <SelectItem key={q.id} value={q.id}>
                  {q.title} · {q.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-2 block">Link inspection (optional)</Label>
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
                  Inspection · {i.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="job-notes">Notes</Label>
        <Textarea
          id="job-notes"
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
        <Button type="submit" disabled={saving || !vehicleId || !title}>
          {saving ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
