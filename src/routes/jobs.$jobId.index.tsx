import { Link, useNavigate } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import {
  useJob,
  useJobLabor,
  useJobNotes,
  useJobStatusHistory,
} from "@/modules/jobs/hooks";
import { StatusControls } from "@/modules/jobs/components/StatusControls";
import { AssignmentControl } from "@/modules/jobs/components/AssignmentControl";
import {
  LaborForm,
  LaborList,
} from "@/modules/jobs/components/LaborForm";
import { NoteForm, NoteList } from "@/modules/jobs/components/NoteForm";
import { useVehicle } from "@/modules/vehicles/hooks";
import { useCustomer } from "@/modules/crm/hooks";

export const Route = createModuleRoute("/jobs/$jobId/")({
  moduleId: "jobs",
  component: JobDetail,
});

function JobDetail() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const { data: job, loading } = useJob(jobId);
  const { data: history } = useJobStatusHistory(jobId);
  const { data: labor } = useJobLabor(jobId);
  const { data: notes } = useJobNotes(jobId);
  const { data: vehicle } = useVehicle(job?.vehicleId);
  const { data: customer } = useCustomer(job?.customerId);
  const canWrite = useHasCapability("jobs.write");

  if (loading || !job)
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {job.title}
          </h1>
          <p className="text-xs text-muted-foreground">
            Status <strong>{job.status}</strong> · Priority {job.priority} ·
            Updated {new Date(job.updatedAt).toLocaleString()}
          </p>
        </div>
        {canWrite && (
          <Button
            variant="outline"
            onClick={() =>
              navigate({
                to: "/jobs/$jobId/edit",
                params: { jobId },
              })
            }
          >
            <Pencil className="mr-1 h-4 w-4" /> Edit
          </Button>
        )}
      </header>

      <section className="grid gap-4 sm:grid-cols-4 text-sm">
        <div>
          <h2 className="text-xs font-semibold uppercase text-muted-foreground">
            Customer
          </h2>
          {customer ? (
            <Link
              to="/customers/$customerId"
              params={{ customerId: customer.id }}
              className="text-primary underline"
            >
              {customer.displayName}
            </Link>
          ) : (
            <p className="text-muted-foreground">Unknown</p>
          )}
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase text-muted-foreground">
            Vehicle
          </h2>
          {vehicle ? (
            <Link
              to="/vehicles/$vehicleId"
              params={{ vehicleId: vehicle.id }}
              className="text-primary underline"
            >
              {vehicle.year ? `${vehicle.year} ` : ""}
              {vehicle.make} {vehicle.model}
            </Link>
          ) : (
            <p className="text-muted-foreground">Unknown</p>
          )}
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase text-muted-foreground">
            Quote
          </h2>
          {job.quoteId ? (
            <Link
              to="/quotes/$quoteId"
              params={{ quoteId: job.quoteId }}
              className="text-primary underline"
            >
              View quote
            </Link>
          ) : (
            <p className="text-muted-foreground">Not linked</p>
          )}
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase text-muted-foreground">
            Inspection
          </h2>
          {job.inspectionId ? (
            <Link
              to="/inspections/$inspectionId"
              params={{ inspectionId: job.inspectionId }}
              className="text-primary underline"
            >
              View inspection
            </Link>
          ) : (
            <p className="text-muted-foreground">Not linked</p>
          )}
        </div>
      </section>

      {(job.description || job.scheduledStart || job.scheduledEnd) && (
        <section className="grid gap-4 sm:grid-cols-2">
          {job.description && (
            <div>
              <h2 className="mb-1 text-sm font-semibold">Scope</h2>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {job.description}
              </p>
            </div>
          )}
          {(job.scheduledStart || job.scheduledEnd) && (
            <div>
              <h2 className="mb-1 text-sm font-semibold">Schedule</h2>
              <p className="text-sm text-muted-foreground">
                {job.scheduledStart
                  ? new Date(job.scheduledStart).toLocaleString()
                  : "—"}{" "}
                →{" "}
                {job.scheduledEnd
                  ? new Date(job.scheduledEnd).toLocaleString()
                  : "—"}
              </p>
            </div>
          )}
        </section>
      )}

      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold">Status</h2>
          <StatusControls job={job} />
          {history.length > 0 && (
            <ol className="mt-3 space-y-1 text-xs text-muted-foreground">
              {history.map((h) => (
                <li key={h.id}>
                  {new Date(h.createdAt).toLocaleString()} — {h.fromStatus}{" "}
                  → {h.toStatus}
                  {h.reason ? ` · ${h.reason}` : ""}
                </li>
              ))}
            </ol>
          )}
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold">Assignment</h2>
          <AssignmentControl job={job} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Labor</h2>
        <div className="space-y-3">
          <LaborForm jobId={job.id} />
          <LaborList entries={labor} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Notes</h2>
        <div className="space-y-3">
          <NoteForm jobId={job.id} />
          <NoteList notes={notes} />
        </div>
      </section>
    </div>
  );
}
