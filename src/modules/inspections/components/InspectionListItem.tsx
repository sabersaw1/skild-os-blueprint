import { Link } from "@tanstack/react-router";
import { ClipboardCheck } from "lucide-react";
import type { Inspection } from "../data/schemas";

const STATUS_LABEL: Record<Inspection["status"], string> = {
  draft: "Draft",
  in_progress: "In progress",
  completed: "Completed",
  archived: "Archived",
};

export function InspectionListItem({
  inspection,
  vehicleLabel,
  customerLabel,
}: {
  inspection: Inspection;
  vehicleLabel?: string;
  customerLabel?: string;
}) {
  return (
    <Link
      to="/inspections/$inspectionId"
      params={{ inspectionId: inspection.id }}
      className="flex items-start gap-3 rounded-md border border-border bg-card px-3 py-2 transition-colors hover:bg-accent"
    >
      <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
        <ClipboardCheck className="h-4 w-4" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">
            {vehicleLabel ?? "Vehicle"}
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
            {STATUS_LABEL[inspection.status]}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {customerLabel ?? "Customer"} ·{" "}
          {inspection.findings.length} finding
          {inspection.findings.length === 1 ? "" : "s"} ·{" "}
          {new Date(inspection.updatedAt).toLocaleDateString()}
        </span>
      </span>
    </Link>
  );
}
