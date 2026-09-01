import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { useAttentionSummary } from "../hooks";
import type { AttentionPriority } from "../data/schemas";

const VARIANT: Record<AttentionPriority, "default" | "secondary" | "destructive" | "outline"> = {
  urgent: "destructive",
  high: "default",
  normal: "secondary",
  low: "outline",
};

export function AttentionWidget() {
  const { items, loading } = useAttentionSummary();
  const top = items.slice(0, 5);

  return (
    <div className="space-y-2">
      {loading ? (
        <p className="text-sm text-muted-foreground">Reviewing the shop…</p>
      ) : top.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing in the records is waiting on you right now.
        </p>
      ) : (
        <ul className="space-y-2">
          {top.map((item) => (
            <li key={item.id} className="text-sm">
              <div className="flex items-start gap-2">
                <Badge variant={VARIANT[item.priority]} className="text-[10px]">
                  {item.priority}
                </Badge>
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.reason}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Link to="/jarvis" className="text-xs text-muted-foreground hover:underline">
        {items.length > top.length
          ? `${items.length - top.length} more — open Jarvis`
          : "Ask Jarvis"}
      </Link>
    </div>
  );
}
