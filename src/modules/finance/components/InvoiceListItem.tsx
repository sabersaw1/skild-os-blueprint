import { Link } from "@tanstack/react-router";
import { Receipt } from "lucide-react";
import { formatCents } from "@/core/money";
import type { Invoice } from "../data/schemas";

const STATUS_LABEL: Record<Invoice["status"], string> = {
  draft: "Draft",
  issued: "Issued",
  partially_paid: "Part paid",
  paid: "Paid",
  void: "Void",
};

export function InvoiceListItem({
  invoice,
  customerLabel,
}: {
  invoice: Invoice;
  customerLabel?: string;
}) {
  return (
    <Link
      to="/invoices/$invoiceId"
      params={{ invoiceId: invoice.id }}
      className="flex items-start gap-3 rounded-md border border-border bg-card px-3 py-2 transition-colors hover:bg-accent"
    >
      <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Receipt className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{invoice.number}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
            {STATUS_LABEL[invoice.status]}
          </span>
          <span className="ml-auto whitespace-nowrap text-xs font-medium">
            {formatCents(invoice.total)}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {customerLabel ?? "Customer"} ·{" "}
          {invoice.balance > 0 && invoice.status !== "draft"
            ? `${formatCents(invoice.balance)} outstanding`
            : invoice.status === "paid"
              ? "Paid in full"
              : "Not issued"}{" "}
          · {new Date(invoice.issuedAt ?? invoice.createdAt).toLocaleDateString()}
        </span>
      </span>
    </Link>
  );
}
