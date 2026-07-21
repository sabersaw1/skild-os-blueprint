import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { VehicleForm } from "@/modules/vehicles/components/VehicleForm";
import { useVehicleRepository } from "@/modules/vehicles/hooks";
import { useCustomers } from "@/modules/crm/hooks";

const searchSchema = z.object({
  customerId: z.string().optional(),
});

export const Route = createFileRoute("/vehicles/new")({
  validateSearch: searchSchema,
  component: NewVehicle,
});

function NewVehicle() {
  const search = Route.useSearch();
  const repo = useVehicleRepository();
  const navigate = useNavigate();
  const { data: customers } = useCustomers();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">New vehicle</h1>
      <VehicleForm
        customers={customers}
        initial={{ customerId: search.customerId }}
        lockCustomer={!!search.customerId}
        submitLabel="Create"
        onCancel={() => navigate({ to: "/vehicles" })}
        onSubmit={async (values) => {
          const created = await repo.create(values);
          navigate({ to: "/vehicles/$vehicleId", params: { vehicleId: created.id } });
        }}
      />
    </div>
  );
}
