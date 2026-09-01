import { Link } from "@tanstack/react-router";
import { useQuotes } from "../hooks";

const money = (n: number) =>
  n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

export function RecentQuotesWidget() {
  const { data, loading } = useQuotes({ limit: 5 });
  return (
    <div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No quotes yet.{" "}
          <Link to="/quotes/new" className="text-primary underline">
            Draft one
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-1">
          {data.map((q) => (
            <li key={q.id} className="flex items-baseline justify-between gap-2 text-sm">
              <Link
                to="/quotes/$quoteId"
                params={{ quoteId: q.id }}
                className="truncate text-foreground hover:underline"
              >
                {q.title}
              </Link>
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {q.status} · {money(q.totalCents)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
