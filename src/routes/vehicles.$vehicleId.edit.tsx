import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { VehicleForm } from "@/modules/vehicles/components/VehicleForm";
import { useVehicle, useVehicleRepository } from "@/modules/vehicles/hooks";
import { useCustomers } from "@/modules/crm/hooks";

export const Route = createFileRoute("/vehicles/$vehicleId/edit")({
  component: EditVehicle,
});

function EditVehicle() {
  const { vehicleId } = Route.useParams();
  const { data: vehicle, loading } = useVehicle(vehicleId);
  const { data: customers } = useCustomers();
  const repo = useVehicleRepository();
  const navigate = useNavigate();

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!vehicle) return <p className="p-6 text-sm text-muted-foreground">Vehicle not found.</p>;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Edit vehicle</h1>
      <VehicleForm
        customers={customers}
        initial={vehicle}
        lockCustomer
        submitLabel="Save changes"
        onCancel={() =>
          navigate({ to: "/vehicles/$vehicleId", params: { vehicleId } })
        }
        onSubmit={async (values) => {
          const { customerId: _cid, ...patch } = values;
          await repo.update(vehicleId, patch);
          navigate({ to: "/vehicles/$vehicleId", params: { vehicleId } });
        }}
      />
    </div>
  );
}
