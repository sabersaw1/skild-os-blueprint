import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHasCapability } from "@/core/roles/hooks";
import { useJobsRepository } from "../hooks";
import {
  JOB_STATUSES,
  type Job,
  type JobStatus,
} from "../data/schemas";

// Mirror of the repository's ALLOWED_STATUS_FLOW — kept in sync so the UI
// only offers valid transitions. Repository still validates on its own.
const ALLOWED: Record<JobStatus, JobStatus[]> = {
  draft: ["scheduled", "cancelled"],
  scheduled: ["in_progress", "cancelled"],
  in_progress: ["paused", "completed", "cancelled"],
  paused: ["in_progress", "cancelled"],
  completed: [],
  cancelled: [],
};

const LABEL: Record<JobStatus, string> = {
  draft: "Mark scheduled",
  scheduled: "Start",
  in_progress: "In progress",
  paused: "Pause",
  completed: "Complete",
  cancelled: "Cancel",
};

function labelFor(from: JobStatus, to: JobStatus): string {
  if (to === "scheduled" && from === "draft") return "Schedule";
  if (to === "in_progress" && from === "scheduled") return "Start";
  if (to === "in_progress" && from === "paused") return "Resume";
  if (to === "paused") return "Pause";
  if (to === "completed") return "Complete";
  if (to === "cancelled") return "Cancel";
  return LABEL[to] ?? to;
}

export function StatusControls({ job }: { job: Job }) {
  const repo = useJobsRepository();
  const canChange = useHasCapability("jobs.status");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canChange) return null;

  const options = ALLOWED[job.status].filter((s) => JOB_STATUSES.includes(s));

  const run = async (to: JobStatus) => {
    setError(null);
    setBusy(to);
    try {
      await repo.changeStatus(job.id, to, {
        reason: reason.trim() || undefined,
      });
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  if (options.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Status is <strong>{job.status}</strong> — no further transitions.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Input
        placeholder="Optional reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {options.map((to) => (
          <Button
            key={to}
            size="sm"
            variant={to === "cancelled" ? "outline" : "default"}
            onClick={() => run(to)}
            disabled={busy !== null}
          >
            {busy === to ? "…" : labelFor(job.status, to)}
          </Button>
        ))}
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
