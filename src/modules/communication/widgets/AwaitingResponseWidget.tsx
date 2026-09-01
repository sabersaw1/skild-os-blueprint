import { Link } from "@tanstack/react-router";
import { useConversations } from "../hooks";
import { formatAge } from "../data/time";

export function AwaitingResponseWidget() {
  const { data, loading } = useConversations({
    awaitingParty: "skild",
    limit: 5,
  });

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing waiting on us.{" "}
        <Link to="/conversations" className="text-primary underline">
          View conversations
        </Link>
        .
      </p>
    );
  }

  return (
    <ul className="space-y-2 text-sm">
      {data.map((c) => (
        <li key={c.id}>
          <Link
            to="/conversations/$conversationId"
            params={{ conversationId: c.id }}
            className="flex items-center justify-between gap-2 hover:underline"
          >
            <span className="truncate">
              {c.subject ?? "Untitled thread"}
              <span className="ml-2 text-xs uppercase text-muted-foreground">
                {c.channel}
              </span>
            </span>
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {formatAge(c.lastMessageAt ?? c.createdAt)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
