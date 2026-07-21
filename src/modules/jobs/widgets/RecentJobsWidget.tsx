import { Link } from "@tanstack/react-router";
import { useJobs } from "../hooks";

export function RecentJobsWidget() {
  const { data, loading } = useJobs({ limit: 5 });
  return (
    <div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No jobs yet.{" "}
          <Link to="/jobs/new" className="text-primary underline">
            Create one
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-1">
          {data.map((j) => (
            <li
              key={j.id}
              className="flex items-baseline justify-between gap-2 text-sm"
            >
              <Link
                to="/jobs/$jobId"
                params={{ jobId: j.id }}
                className="truncate text-foreground hover:underline"
              >
                {j.title}
              </Link>
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {j.status} · {j.priority}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
