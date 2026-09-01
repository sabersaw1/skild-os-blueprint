import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/core/money";
import { useIntelligenceAttention } from "../hooks";

const KIND_LABEL: Record<string, string> = {
  stale_lead: "stale lead",
  stale_quote: "quote aging",
  overdue_follow_up: "follow-up overdue",
  outstanding_invoice: "unpaid invoice",
  uninvoiced_job: "not invoiced",
};

/**
 * Command Center widget. Shows what the OS can actually prove needs
 * attention — computed from stored records, with an honest empty state.
 */
export function IntelligenceAttentionWidget() {
  const { data: items, loading, error } = useIntelligenceAttention();
  const top = items.slice(0, 5);

  return (
    <div className="space-y-2">
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-sm text-muted-foreground">{error}</p>
      ) : top.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing is overdue in the records Skild OS holds.
        </p>
      ) : (
        <ul className="space-y-2">
          {top.map((item) => (
            <li key={item.id} className="text-sm">
              <div className="font-medium">{item.title}</div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <Badge variant="secondary" className="text-[10px]">
                  {KIND_LABEL[item.kind] ?? item.kind}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {item.ageDays} day(s)
                  {item.amountCents !== undefined
                    ? ` · ${formatCents(item.amountCents)}`
                    : ""}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Link
        to="/intelligence"
        className="block text-xs text-muted-foreground hover:underline"
      >
        Open Business Intelligence
      </Link>
    </div>
  );
}
