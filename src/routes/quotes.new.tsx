import { useNavigate } from "@tanstack/react-router";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import { QuoteForm } from "@/modules/quotes/components/QuoteForm";
import { useQuotesRepository } from "@/modules/quotes/hooks";
import { useVehicles } from "@/modules/vehicles/hooks";
import { useCustomers } from "@/modules/crm/hooks";
import { useInspections } from "@/modules/inspections/hooks";

export const Route = createModuleRoute("/quotes/new")({
  moduleId: "quotes",
  component: NewQuote,
});

function NewQuote() {
  const repo = useQuotesRepository();
  const navigate = useNavigate();
  const { data: vehicles } = useVehicles();
  const { data: customers } = useCustomers();
  const { data: inspections } = useInspections();
  const canWrite = useHasCapability("quotes.write");

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">New quote</h1>
      {!canWrite ? (
        <p className="text-sm text-muted-foreground">
          You do not have permission to create quotes.
        </p>
      ) : vehicles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You need at least one vehicle before drafting a quote.
        </p>
      ) : (
        <QuoteForm
          vehicles={vehicles}
          customers={customers}
          inspections={inspections}
          submitLabel="Create"
          onCancel={() => navigate({ to: "/quotes" })}
          onSubmit={async (values) => {
            const created = await repo.createQuote({
              customerId: values.customerId,
              vehicleId: values.vehicleId,
              inspectionId: values.inspectionId,
              title: values.title,
              lineItems: values.lineItems,
              discount: values.discount,
              tax: values.tax,
              notes: values.notes,
            });
            navigate({
              to: "/quotes/$quoteId",
              params: { quoteId: created.id },
            });
          }}
        />
      )}
    </div>
  );
}
