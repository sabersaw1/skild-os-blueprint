import { Link } from "@tanstack/react-router";
import { Wrench } from "lucide-react";
import type { Job } from "../data/schemas";

const STATUS_LABEL: Record<Job["status"], string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  in_progress: "In progress",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
};

const PRIORITY_LABEL: Record<Job["priority"], string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export function JobListItem({
  job,
  vehicleLabel,
  customerLabel,
}: {
  job: Job;
  vehicleLabel?: string;
  customerLabel?: string;
}) {
  return (
    <Link
      to="/jobs/$jobId"
      params={{ jobId: job.id }}
      className="flex items-start gap-3 rounded-md border border-border bg-card px-3 py-2 transition-colors hover:bg-accent"
    >
      <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Wrench className="h-4 w-4" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{job.title}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
            {STATUS_LABEL[job.status]}
          </span>
          <span className="ml-auto whitespace-nowrap text-xs font-medium text-muted-foreground">
            {PRIORITY_LABEL[job.priority]}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {customerLabel ?? "Customer"} · {vehicleLabel ?? "Vehicle"}
          {job.assignedTo ? ` · ${job.assignedTo}` : ""} ·{" "}
          {new Date(job.updatedAt).toLocaleDateString()}
        </span>
      </span>
    </Link>
  );
}
