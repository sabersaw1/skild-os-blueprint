import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { useLeads, useLeadsNeedingAttention } from "../hooks";

const REASON_LABEL: Record<string, string> = {
  never_contacted: "never contacted",
  awaiting_skild: "awaiting us",
  follow_up_due: "follow-up due",
  follow_up_overdue: "follow-up overdue",
  stale: "stale",
  quote_sent_no_response: "quote sent, no response",
};

export function LeadAttentionWidget() {
  const { data: attention, loading } = useLeadsNeedingAttention();
  const { data: leads } = useLeads();

  const byId = new Map(leads.map((l) => [l.id, l]));
  const top = attention.slice(0, 5);

  return (
    <div className="space-y-2">
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : top.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No leads are waiting on us.
        </p>
      ) : (
        <ul className="space-y-2">
          {top.map((item) => {
            const lead = byId.get(item.leadId);
            return (
              <li key={item.leadId} className="text-sm">
                <Link
                  to="/leads/$leadId"
                  params={{ leadId: item.leadId }}
                  className="font-medium hover:underline"
                >
                  {lead?.serviceRequested ?? "Unspecified service"}
                </Link>
                <div className="mt-1 flex flex-wrap gap-1">
                  {item.reasons.map((r) => (
                    <Badge key={r} variant="secondary" className="text-[10px]">
                      {REASON_LABEL[r] ?? r}
                    </Badge>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {attention.length > top.length && (
        <Link
          to="/leads"
          className="text-xs text-muted-foreground hover:underline"
        >
          {attention.length - top.length} more need attention
        </Link>
      )}
    </div>
  );
}
