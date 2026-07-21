import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import type { KnowledgeDocument } from "../data/schemas";

export function DocumentListItem({ document: doc }: { document: KnowledgeDocument }) {
  return (
    <Link
      to="/knowledge/$knowledgeId"
      params={{ knowledgeId: doc.id }}
      className="flex items-start gap-3 rounded-md border border-border bg-card px-3 py-2 transition-colors hover:bg-accent"
    >
      <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
        <BookOpen className="h-4 w-4" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{doc.title}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
            {doc.type.replace("_", " ")}
          </span>
          {doc.status !== "active" && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
              {doc.status}
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {doc.summary || "—"} · v{doc.versionNumber}
        </span>
      </span>
    </Link>
  );
}
