import { useNavigate } from "@tanstack/react-router";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import { JobForm } from "@/modules/jobs/components/JobForm";
import { useJobsRepository } from "@/modules/jobs/hooks";
import { useVehicles } from "@/modules/vehicles/hooks";
import { useCustomers } from "@/modules/crm/hooks";
import { useInspections } from "@/modules/inspections/hooks";
import { useQuotes } from "@/modules/quotes/hooks";

export const Route = createModuleRoute("/jobs/new")({
  moduleId: "jobs",
  component: NewJob,
});

function NewJob() {
  const repo = useJobsRepository();
  const navigate = useNavigate();
  const { data: vehicles } = useVehicles();
  const { data: customers } = useCustomers();
  const { data: inspections } = useInspections();
  const { data: quotes } = useQuotes();
  const canWrite = useHasCapability("jobs.write");

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">New job</h1>
      {!canWrite ? (
        <p className="text-sm text-muted-foreground">
          You do not have permission to create jobs.
        </p>
      ) : vehicles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You need at least one vehicle before creating a job.
        </p>
      ) : (
        <JobForm
          vehicles={vehicles}
          customers={customers}
          inspections={inspections}
          quotes={quotes}
          submitLabel="Create"
          onCancel={() => navigate({ to: "/jobs" })}
          onSubmit={async (values) => {
            const created = await repo.create({
              customerId: values.customerId,
              vehicleId: values.vehicleId,
              quoteId: values.quoteId,
              inspectionId: values.inspectionId,
              title: values.title,
              description: values.description,
              priority: values.priority,
              scheduledStart: values.scheduledStart,
              scheduledEnd: values.scheduledEnd,
              assignedTo: values.assignedTo,
              notes: values.notes,
            });
            navigate({
              to: "/jobs/$jobId",
              params: { jobId: created.id },
            });
          }}
        />
      )}
    </div>
  );
}
