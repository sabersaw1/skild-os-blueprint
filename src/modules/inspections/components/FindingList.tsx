import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InspectionFinding } from "../data/schemas";

const SEVERITY_STYLE: Record<InspectionFinding["severity"], string> = {
  info: "bg-muted text-muted-foreground",
  advisory: "bg-primary/10 text-primary",
  required: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  safety: "bg-destructive/15 text-destructive",
};

export function FindingList({
  findings,
  onQueuePhoto,
}: {
  findings: InspectionFinding[];
  onQueuePhoto?: (findingId: string) => void | Promise<void>;
}) {
  if (findings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No findings recorded yet.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {findings.map((f) => (
        <li
          key={f.id}
          className="rounded-md border border-border bg-card p-3 text-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{f.title}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${SEVERITY_STYLE[f.severity]}`}
                >
                  {f.severity}
                </span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                  {f.status}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {f.category}
              </p>
              {f.description && (
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {f.description}
                </p>
              )}
              {f.mediaKeys.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {f.mediaKeys.length} photo
                  {f.mediaKeys.length === 1 ? "" : "s"} queued
                </p>
              )}
            </div>
            {onQueuePhoto && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onQueuePhoto(f.id)}
              >
                <Camera className="mr-1 h-4 w-4" /> Queue photo
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
