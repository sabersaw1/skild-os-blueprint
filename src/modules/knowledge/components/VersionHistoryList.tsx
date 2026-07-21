import type { KnowledgeVersion } from "../data/schemas";

export function VersionHistoryList({ versions }: { versions: KnowledgeVersion[] }) {
  if (versions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No version history yet.</p>
    );
  }
  return (
    <ol className="space-y-2">
      {versions.map((v) => (
        <li
          key={v.id}
          className="rounded-md border border-border bg-card p-3 text-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">Version {v.versionNumber}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(v.createdAt).toLocaleString()}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {v.changeReason}
          </p>
        </li>
      ))}
    </ol>
  );
}
