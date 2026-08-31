import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import { formatCents } from "@/core/money";
import { useInvoices } from "@/modules/finance/hooks";
import { InvoiceListItem } from "@/modules/finance/components/InvoiceListItem";
import { INVOICE_STATUSES, type InvoiceStatus } from "@/modules/finance/data/schemas";
import { useCustomers } from "@/modules/crm/hooks";

export const Route = createModuleRoute("/invoices/")({
  moduleId: "finance",
  head: () => ({
    meta: [
      { title: "All Invoices — Skild OS" },
      { name: "description", content: "Browse, filter, and track every shop invoice by status and outstanding balance." },
      { property: "og:title", content: "All Invoices — Skild OS" },
      { property: "og:description", content: "Browse, filter, and track every shop invoice by status and outstanding balance." },
    ],
  }),
  component: InvoicesIndex,
});

function InvoicesIndex() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InvoiceStatus | "all">("all");
  const [outstandingOnly, setOutstandingOnly] = useState(false);

  const query = useMemo(
    () => ({
      search: search || undefined,
      status: status === "all" ? undefined : status,
      outstandingOnly: outstandingOnly || undefined,
    }),
    [search, status, outstandingOnly],
  );

  const { data, loading } = useInvoices(query);
  const { data: customers } = useCustomers();
  const canWrite = useHasCapability("finance.invoice.write");
  const canRead = useHasCapability("finance.read");

  const outstanding = data.reduce(
    (sum, i) => sum + (i.status === "void" ? 0 : i.balance),
    0,
  );

  if (!canRead) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        You do not have permission to view invoices.
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-xs text-muted-foreground">
            {data.length} invoice{data.length === 1 ? "" : "s"} ·{" "}
            {formatCents(outstanding)} outstanding
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => navigate({ to: "/invoices/new" })}>
            <Plus className="mr-1 h-4 w-4" /> New invoice
          </Button>
        )}
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          placeholder="Search number or notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value as InvoiceStatus | "all")}
        >
          <option value="all">All statuses</option>
          {INVOICE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={outstandingOnly}
            onChange={(e) => setOutstandingOnly(e.target.checked)}
          />
          Outstanding only
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No invoices found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((inv) => (
            <InvoiceListItem
              key={inv.id}
              invoice={inv}
              customerLabel={
                customers.find((c) => c.id === inv.customerId)?.displayName
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
