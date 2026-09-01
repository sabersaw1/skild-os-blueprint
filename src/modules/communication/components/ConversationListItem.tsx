import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import type { Conversation } from "../data/schemas";
import { formatAge } from "../data/time";

export function ConversationListItem({
  conversation,
  customerLabel,
}: {
  conversation: Conversation;
  customerLabel?: string;
}) {
  const c = conversation;
  return (
    <li>
      <Link
        to="/conversations/$conversationId"
        params={{ conversationId: c.id }}
        className="flex items-start justify-between gap-3 rounded-md border border-border p-3 transition-colors hover:bg-accent"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {c.subject ?? "Untitled thread"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {customerLabel ?? "Customer"} · {c.channel}
            {c.source ? ` · ${c.source}` : ""}
          </p>
          {c.refs.length > 0 && (
            <p className="mt-1 truncate text-[11px] text-muted-foreground">
              linked: {c.refs.map((r) => r.type).join(", ")}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge variant={c.awaitingParty === "skild" ? "default" : "secondary"}>
            {c.status.replace("_", " ")}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            {formatAge(c.lastMessageAt ?? c.createdAt)}
          </span>
        </div>
      </Link>
    </li>
  );
}
