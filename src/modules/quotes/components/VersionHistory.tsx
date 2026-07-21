import type { QuoteVersion } from "../data/schemas";

const money = (n: number) =>
  n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

export function VersionHistory({ versions }: { versions: QuoteVersion[] }) {
  if (versions.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No versions yet.</p>
    );
  }
  return (
    <ol className="space-y-2">
      {versions
        .slice()
        .reverse()
        .map((v) => (
          <li
            key={v.id}
            className="rounded-md border border-border bg-card p-2 text-sm"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">Version {v.versionNumber}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(v.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {v.changeReason}
            </p>
            <p className="text-xs">
              {v.snapshot.lineItems.length} item
              {v.snapshot.lineItems.length === 1 ? "" : "s"} ·{" "}
              {money(v.snapshot.total)}
            </p>
          </li>
        ))}
    </ol>
  );
}
