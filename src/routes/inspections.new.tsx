import { useNavigate } from "@tanstack/react-router";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import { InspectionForm } from "@/modules/inspections/components/InspectionForm";
import {
  useInspectionsRepository,
  useInspectionTemplates,
} from "@/modules/inspections/hooks";
import { useVehicles } from "@/modules/vehicles/hooks";
import { useCustomers } from "@/modules/crm/hooks";

export const Route = createModuleRoute("/inspections/new")({
  moduleId: "inspections",
  component: NewInspection,
});

function NewInspection() {
  const repo = useInspectionsRepository();
  const navigate = useNavigate();
  const { data: vehicles } = useVehicles();
  const { data: customers } = useCustomers();
  const { data: templates } = useInspectionTemplates();
  const canWrite = useHasCapability("inspections.write");

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">
        New inspection
      </h1>
      {!canWrite ? (
        <p className="text-sm text-muted-foreground">
          You do not have permission to create inspections.
        </p>
      ) : vehicles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You need at least one vehicle before starting an inspection.
        </p>
      ) : (
        <InspectionForm
          vehicles={vehicles}
          customers={customers}
          templates={templates}
          submitLabel="Create"
          onCancel={() => navigate({ to: "/inspections" })}
          onSubmit={async (values) => {
            const created = await repo.createInspection(values);
            navigate({
              to: "/inspections/$inspectionId",
              params: { inspectionId: created.id },
            });
          }}
        />
      )}
    </div>
  );
}
