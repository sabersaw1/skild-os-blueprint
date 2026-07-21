import type { KnowledgeLink } from "../data/schemas";

export function LinkList({ links }: { links: KnowledgeLink[] }) {
  if (links.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No linked items.</p>
    );
  }
  return (
    <ul className="space-y-2">
      {links.map((l) => (
        <li
          key={l.id}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <span className="font-mono text-xs text-muted-foreground">
            {l.targetType}
          </span>{" "}
          <span className="font-mono text-xs">{l.targetId}</span>
        </li>
      ))}
    </ul>
  );
}
