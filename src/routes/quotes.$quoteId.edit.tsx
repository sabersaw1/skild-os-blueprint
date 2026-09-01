import { useNavigate } from "@tanstack/react-router";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import { QuoteForm } from "@/modules/quotes/components/QuoteForm";
import { useQuote, useQuotesRepository } from "@/modules/quotes/hooks";
import { useVehicles } from "@/modules/vehicles/hooks";
import { useCustomers } from "@/modules/crm/hooks";
import { useInspections } from "@/modules/inspections/hooks";
import type { LineItemInput } from "@/modules/quotes/data/schemas";

export const Route = createModuleRoute("/quotes/$quoteId/edit")({
  moduleId: "quotes",
  component: EditQuote,
});

function EditQuote() {
  const { quoteId } = Route.useParams();
  const navigate = useNavigate();
  const repo = useQuotesRepository();
  const { data: quote, loading } = useQuote(quoteId);
  const { data: vehicles } = useVehicles();
  const { data: customers } = useCustomers();
  const { data: inspections } = useInspections();
  const canWrite = useHasCapability("quotes.write");
  const canVersion = useHasCapability("quotes.version");

  if (loading || !quote)
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;

  if (!canWrite || !canVersion) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">
          Edit quote
        </h1>
        <p className="text-sm text-muted-foreground">
          You do not have permission to edit quotes.
        </p>
      </div>
    );
  }

  if (quote.status !== "draft") {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">
          Edit quote
        </h1>
        <p className="text-sm text-muted-foreground">
          Only draft quotes can be edited (current status:{" "}
          <strong>{quote.status}</strong>).
        </p>
      </div>
    );
  }

  const initialLineItems: LineItemInput[] = quote.lineItems.map((li) => ({
    description: li.description,
    category: li.category,
    quantity: li.quantity,
    unitPriceCents: li.unitPriceCents,
    laborHours: li.laborHours,
    partReference: li.partReference,
  }));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">
        Edit quote
      </h1>
      <QuoteForm
        vehicles={vehicles}
        customers={customers}
        inspections={inspections}
        requireChangeReason
        submitLabel="Save new version"
        initial={{
          customerId: quote.customerId,
          vehicleId: quote.vehicleId,
          inspectionId: quote.inspectionId,
          title: quote.title,
          lineItems: initialLineItems,
          discountCents: quote.discountCents,
          taxCents: quote.taxCents,
          notes: quote.notes,
        }}
        onCancel={() =>
          navigate({ to: "/quotes/$quoteId", params: { quoteId } })
        }
        onSubmit={async (values, changeReason) => {
          await repo.updateQuote(quoteId, {
            title: values.title,
            inspectionId: values.inspectionId ?? null,
            lineItems: values.lineItems,
            discountCents: values.discountCents,
            taxCents: values.taxCents,
            notes: values.notes,
            changeReason,
          });
          navigate({ to: "/quotes/$quoteId", params: { quoteId } });
        }}
      />
    </div>
  );
}
