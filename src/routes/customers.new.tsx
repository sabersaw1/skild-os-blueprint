import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CustomerForm } from "@/modules/crm/components/CustomerForm";
import { useCustomerRepository } from "@/modules/crm/hooks";

export const Route = createFileRoute("/customers/new")({
  component: NewCustomer,
});

function NewCustomer() {
  const repo = useCustomerRepository();
  const navigate = useNavigate();
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">New customer</h1>
      <CustomerForm
        submitLabel="Create"
        onCancel={() => navigate({ to: "/customers" })}
        onSubmit={async (values) => {
          const created = await repo.create(values);
          navigate({ to: "/customers/$customerId", params: { customerId: created.id } });
        }}
      />
    </div>
  );
}
