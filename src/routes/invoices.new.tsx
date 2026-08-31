import { useNavigate } from "@tanstack/react-router";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import { InvoiceForm } from "@/modules/finance/components/InvoiceForm";
import { useFinanceRepository } from "@/modules/finance/hooks";
import { useCustomers } from "@/modules/crm/hooks";
import { useVehicles } from "@/modules/vehicles/hooks";
import { useJobs } from "@/modules/jobs/hooks";
import { useQuotes } from "@/modules/quotes/hooks";

export const Route = createModuleRoute("/invoices/new")({
  moduleId: "finance",
  head: () => ({
    meta: [
      { title: "New Invoice — Skild OS" },
      { name: "description", content: "Create a draft invoice with line items, discount, and tax in exact cents." },
      { property: "og:title", content: "New Invoice — Skild OS" },
      { property: "og:description", content: "Create a draft invoice with line items, discount, and tax in exact cents." },
    ],
  }),
  component: NewInvoice,
});

function NewInvoice() {
  const repo = useFinanceRepository();
  const navigate = useNavigate();
  const { data: customers } = useCustomers();
  const { data: vehicles } = useVehicles();
  const { data: jobs } = useJobs();
  const { data: quotes } = useQuotes();
  const canWrite = useHasCapability("finance.invoice.write");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">
        New invoice
      </h1>
      {!canWrite ? (
        <p className="text-sm text-muted-foreground">
          You do not have permission to create invoices.
        </p>
      ) : customers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You need at least one customer before creating an invoice.
        </p>
      ) : (
        <InvoiceForm
          customers={customers.map((c) => ({ id: c.id, label: c.displayName }))}
          vehicles={vehicles.map((v) => ({
            id: v.id,
            label: `${v.year ? `${v.year} ` : ""}${v.make} ${v.model}`,
          }))}
          jobs={jobs.map((j) => ({ id: j.id, label: j.title }))}
          quotes={quotes.map((q) => ({ id: q.id, label: q.title }))}
          submitLabel="Create draft"
          onCancel={() => navigate({ to: "/invoices" })}
          onSubmit={async (values) => {
            const created = await repo.createInvoice(values);
            navigate({
              to: "/invoices/$invoiceId",
              params: { invoiceId: created.id },
            });
          }}
        />
      )}
    </div>
  );
}
