import { useState } from "react";
import { CloudUpload, RefreshCw } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useOutbox } from "@/sync/outbox";
import { useUploadQueue } from "@/storage/uploadQueue";

export function StatusIndicator() {
  const outbox = useOutbox();
  const uploads = useUploadQueue();
  const [open, setOpen] = useState(false);

  const pending = outbox.length + uploads.length;
  const label = pending === 0 ? "Idle — local only" : `${pending} pending`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-xs text-muted-foreground"
          aria-label="Sync and upload status"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 text-sm">
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2 font-medium">
              <RefreshCw className="h-4 w-4" />
              Sync Engine
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {outbox.length === 0
                ? "Outbox empty. No server sync is configured in Phase 1."
                : `${outbox.length} outbox item(s) queued.`}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 font-medium">
              <CloudUpload className="h-4 w-4" />
              Upload Queue
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {uploads.length === 0
                ? "No pending uploads. Storage provider not yet wired."
                : `${uploads.length} upload(s) queued.`}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            These queues are local stubs. Real sync + uploads land with the
            Inspections module in a later phase.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
