import { useNavigate } from "@tanstack/react-router";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import { InvoiceForm } from "@/modules/finance/components/InvoiceForm";
import { useFinanceRepository, useInvoice } from "@/modules/finance/hooks";
import { useCustomers } from "@/modules/crm/hooks";
import { useVehicles } from "@/modules/vehicles/hooks";
import { useJobs } from "@/modules/jobs/hooks";
import { useQuotes } from "@/modules/quotes/hooks";

export const Route = createModuleRoute("/invoices/$invoiceId/edit")({
  moduleId: "finance",
  head: () => ({
    meta: [
      { title: "Edit Invoice — Skild OS" },
      { name: "description", content: "Edit a draft invoice before it is issued and becomes immutable." },
      { property: "og:title", content: "Edit Invoice — Skild OS" },
      { property: "og:description", content: "Edit a draft invoice before it is issued and becomes immutable." },
    ],
  }),
  component: EditInvoice,
});

function EditInvoice() {
  const { invoiceId } = Route.useParams();
  const navigate = useNavigate();
  const repo = useFinanceRepository();
  const { data: invoice, loading } = useInvoice(invoiceId);
  const { data: customers } = useCustomers();
  const { data: vehicles } = useVehicles();
  const { data: jobs } = useJobs();
  const { data: quotes } = useQuotes();
  const canWrite = useHasCapability("finance.invoice.write");

  if (loading || !invoice)
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;

  const back = () =>
    navigate({ to: "/invoices/$invoiceId", params: { invoiceId } });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">
        Edit {invoice.number}
      </h1>
      {!canWrite ? (
        <p className="text-sm text-muted-foreground">
          You do not have permission to edit invoices.
        </p>
      ) : invoice.status !== "draft" ? (
        <p className="text-sm text-muted-foreground">
          {invoice.number} has been issued and is an immutable financial
          record. Void it and issue a replacement instead.
        </p>
      ) : (
        <InvoiceForm
          initial={invoice}
          customers={customers.map((c) => ({ id: c.id, label: c.displayName }))}
          vehicles={vehicles.map((v) => ({
            id: v.id,
            label: `${v.year ? `${v.year} ` : ""}${v.make} ${v.model}`,
          }))}
          jobs={jobs.map((j) => ({ id: j.id, label: j.title }))}
          quotes={quotes.map((q) => ({ id: q.id, label: q.title }))}
          submitLabel="Save draft"
          onCancel={back}
          onSubmit={async (values) => {
            await repo.updateInvoice(invoiceId, {
              vehicleId: values.vehicleId ?? null,
              jobId: values.jobId ?? null,
              quoteId: values.quoteId ?? null,
              lines: values.lines,
              discount: values.discount,
              tax: values.tax,
              terms: values.terms,
              notes: values.notes,
              dueAt: values.dueAt ?? null,
            });
            back();
          }}
        />
      )}
    </div>
  );
}
