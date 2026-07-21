import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CustomerForm } from "@/modules/crm/components/CustomerForm";
import { useCustomer, useCustomerRepository } from "@/modules/crm/hooks";

export const Route = createFileRoute("/customers/$customerId/edit")({
  component: EditCustomer,
});

function EditCustomer() {
  const { customerId } = Route.useParams();
  const { data: customer, loading } = useCustomer(customerId);
  const repo = useCustomerRepository();
  const navigate = useNavigate();

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!customer) return <p className="p-6 text-sm text-muted-foreground">Customer not found.</p>;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Edit customer</h1>
      <CustomerForm
        initial={customer}
        submitLabel="Save changes"
        onCancel={() =>
          navigate({ to: "/customers/$customerId", params: { customerId } })
        }
        onSubmit={async (values) => {
          await repo.update(customerId, values);
          navigate({ to: "/customers/$customerId", params: { customerId } });
        }}
      />
    </div>
  );
}
