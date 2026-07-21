import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHasCapability } from "@/core/roles/hooks";
import { useJobsRepository } from "../hooks";
import type { Job } from "../data/schemas";

export function AssignmentControl({ job }: { job: Job }) {
  const repo = useJobsRepository();
  const canAssign = useHasCapability("jobs.assign");
  const [value, setValue] = useState(job.assignedTo ?? "");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState<"assign" | "clear" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canAssign) {
    return (
      <p className="text-sm text-muted-foreground">
        {job.assignedTo ? `Assigned to ${job.assignedTo}` : "Unassigned"}
      </p>
    );
  }

  const run = async (mode: "assign" | "clear") => {
    setError(null);
    setSaving(mode);
    try {
      await repo.assign(job.id, {
        assignedTo: mode === "clear" ? null : value.trim() || null,
        reason: reason.trim() || undefined,
      });
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-2">
      <Input
        placeholder="Technician name or id"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <Input
        placeholder="Optional reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => run("assign")}
          disabled={saving !== null || !value.trim()}
        >
          {saving === "assign" ? "…" : "Assign"}
        </Button>
        {job.assignedTo && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => run("clear")}
            disabled={saving !== null}
          >
            {saving === "clear" ? "…" : "Unassign"}
          </Button>
        )}
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
