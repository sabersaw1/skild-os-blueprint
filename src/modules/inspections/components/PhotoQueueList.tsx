import type { InspectionPhoto } from "../data/schemas";

export function PhotoQueueList({ photos }: { photos: InspectionPhoto[] }) {
  if (photos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No photos queued yet.
      </p>
    );
  }
  return (
    <ul className="space-y-1">
      {photos.map((p) => (
        <li
          key={p.id}
          className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs"
        >
          <span className="truncate font-mono">{p.logicalKey}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 uppercase text-muted-foreground">
            {p.uploadStatus}
          </span>
        </li>
      ))}
    </ul>
  );
}
