import { formatCents as money } from "@/core/money";
import { Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import type { Quote } from "../data/schemas";

const STATUS_LABEL: Record<Quote["status"], string> = {
  draft: "Draft",
  sent: "Sent",
  approved: "Approved",
  declined: "Declined",
  expired: "Expired",
};



export function QuoteListItem({
  quote,
  vehicleLabel,
  customerLabel,
}: {
  quote: Quote;
  vehicleLabel?: string;
  customerLabel?: string;
}) {
  return (
    <Link
      to="/quotes/$quoteId"
      params={{ quoteId: quote.id }}
      className="flex items-start gap-3 rounded-md border border-border bg-card px-3 py-2 transition-colors hover:bg-accent"
    >
      <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
        <FileText className="h-4 w-4" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{quote.title}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
            {STATUS_LABEL[quote.status]}
          </span>
          <span className="ml-auto whitespace-nowrap text-xs font-medium">
            {money(quote.totalCents)}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {customerLabel ?? "Customer"} · {vehicleLabel ?? "Vehicle"} · v
          {quote.currentVersion} ·{" "}
          {new Date(quote.updatedAt).toLocaleDateString()}
        </span>
      </span>
    </Link>
  );
}
