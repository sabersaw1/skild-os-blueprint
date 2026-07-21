import { Link } from "@tanstack/react-router";
import { useInspections } from "../hooks";

export function RecentInspectionsWidget() {
  const { data, loading } = useInspections({ limit: 5 });
  return (
    <div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No inspections yet.{" "}
          <Link to="/inspections/new" className="text-primary underline">
            Start one
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-1">
          {data.map((i) => (
            <li key={i.id} className="truncate text-sm">
              <Link
                to="/inspections/$inspectionId"
                params={{ inspectionId: i.id }}
                className="text-foreground hover:underline"
              >
                Inspection · {i.status}
              </Link>
              <span className="ml-2 text-xs text-muted-foreground">
                {i.findings.length} finding{i.findings.length === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
