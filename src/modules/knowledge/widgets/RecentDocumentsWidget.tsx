import { Link } from "@tanstack/react-router";
import { useKnowledgeDocuments } from "../hooks";

export function RecentDocumentsWidget() {
  const { data, loading } = useKnowledgeDocuments({ limit: 5 });
  return (
    <div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No knowledge documents yet.{" "}
          <Link to="/knowledge/new" className="text-primary underline">
            Create one
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-1">
          {data.map((d) => (
            <li key={d.id} className="truncate text-sm">
              <Link
                to="/knowledge/$knowledgeId"
                params={{ knowledgeId: d.id }}
                className="text-foreground hover:underline"
              >
                {d.title}
              </Link>
              <span className="ml-2 text-xs text-muted-foreground">
                v{d.versionNumber}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
