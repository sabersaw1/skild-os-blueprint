import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHasCapability } from "@/core/roles/hooks";
import { useJobsRepository } from "../hooks";
import type { LaborEntry } from "../data/schemas";
import { formatCents, laborTotalCents, toCents, toDollars } from "@/core/money";

// Rates are held in INTEGER CENTS; dollars exist only inside the input.
const money = formatCents;

export function LaborForm({ jobId }: { jobId: string }) {
  const repo = useJobsRepository();
  const canWrite = useHasCapability("jobs.labor.write");
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState<number>(0.5);
  const [rateCents, setRateCents] = useState<number>(12000);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canWrite) return null;

  return (
    <form
      className="grid gap-2 rounded-md border border-border bg-card p-3 sm:grid-cols-12"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setSaving(true);
        try {
          await repo.addLabor(jobId, { description, hours, rateCents });
          setDescription("");
          setHours(0.5);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="sm:col-span-6">
        <Label htmlFor="lab-desc" className="text-xs">
          Description
        </Label>
        <Input
          id="lab-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Diagnostic, brake install…"
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="lab-hours" className="text-xs">
          Hours
        </Label>
        <Input
          id="lab-hours"
          type="number"
          min={0}
          step="0.25"
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="lab-rate" className="text-xs">
          Rate
        </Label>
        <Input
          id="lab-rate"
          type="number"
          min={0}
          step="0.01"
          value={toDollars(rateCents)}
          onChange={(e) => setRateCents(toCents(e.target.value))}
        />
      </div>
      <div className="flex items-end sm:col-span-2">
        <Button
          type="submit"
          disabled={saving || !description.trim() || hours <= 0}
          className="w-full"
        >
          {saving ? "Adding…" : "Log labor"}
        </Button>
      </div>
      {error && (
        <p
          className="text-sm text-destructive sm:col-span-12"
          role="alert"
        >
          {error}
        </p>
      )}
    </form>
  );
}

export function LaborList({ entries }: { entries: LaborEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No labor logged yet.</p>
    );
  }
  const totalCents = entries.reduce(
    (s, e) => s + laborTotalCents(e.hours, e.rateCents),
    0,
  );
  const totalHours = entries.reduce((s, e) => s + e.hours, 0);
  return (
    <div>
      <ul className="space-y-1">
        {entries.map((e) => (
          <li
            key={e.id}
            className="flex items-baseline justify-between gap-2 text-sm"
          >
            <span className="truncate">
              {e.description}{" "}
              <span className="text-xs text-muted-foreground">
                · {e.hours}h @ {money(e.rateCents)}
              </span>
            </span>
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {money(laborTotalCents(e.hours, e.rateCents))}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-right text-xs font-medium">
        {totalHours}h · {money(totalCents)}
      </p>
    </div>
  );
}
