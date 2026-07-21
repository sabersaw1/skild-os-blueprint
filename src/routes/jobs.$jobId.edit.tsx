import { useNavigate } from "@tanstack/react-router";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import { JobForm } from "@/modules/jobs/components/JobForm";
import { useJob, useJobsRepository } from "@/modules/jobs/hooks";
import { useVehicles } from "@/modules/vehicles/hooks";
import { useCustomers } from "@/modules/crm/hooks";
import { useInspections } from "@/modules/inspections/hooks";
import { useQuotes } from "@/modules/quotes/hooks";

export const Route = createModuleRoute("/jobs/$jobId/edit")({
  moduleId: "jobs",
  component: EditJob,
});

function EditJob() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const repo = useJobsRepository();
  const { data: job, loading } = useJob(jobId);
  const { data: vehicles } = useVehicles();
  const { data: customers } = useCustomers();
  const { data: inspections } = useInspections();
  const { data: quotes } = useQuotes();
  const canWrite = useHasCapability("jobs.write");

  if (loading || !job)
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;

  if (!canWrite) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">
          Edit job
        </h1>
        <p className="text-sm text-muted-foreground">
          You do not have permission to edit jobs.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Edit job</h1>
      <JobForm
        vehicles={vehicles}
        customers={customers}
        inspections={inspections}
        quotes={quotes}
        submitLabel="Save"
        initial={{
          customerId: job.customerId,
          vehicleId: job.vehicleId,
          quoteId: job.quoteId,
          inspectionId: job.inspectionId,
          title: job.title,
          description: job.description,
          priority: job.priority,
          scheduledStart: job.scheduledStart,
          scheduledEnd: job.scheduledEnd,
          assignedTo: job.assignedTo,
          notes: job.notes,
        }}
        onCancel={() => navigate({ to: "/jobs/$jobId", params: { jobId } })}
        onSubmit={async (values) => {
          await repo.update(jobId, {
            title: values.title,
            description: values.description,
            priority: values.priority,
            scheduledStart: values.scheduledStart ?? null,
            scheduledEnd: values.scheduledEnd ?? null,
            notes: values.notes,
            quoteId: values.quoteId ?? null,
            inspectionId: values.inspectionId ?? null,
          });
          navigate({ to: "/jobs/$jobId", params: { jobId } });
        }}
      />
    </div>
  );
}
