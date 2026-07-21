import { Link, useNavigate } from "@tanstack/react-router";
import { Camera, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/roles";
import {
  useFindings,
  useInspection,
  useInspectionPhotos,
  useInspectionsRepository,
} from "@/modules/inspections/hooks";
import { FindingForm } from "@/modules/inspections/components/FindingForm";
import { FindingList } from "@/modules/inspections/components/FindingList";
import { PhotoQueueList } from "@/modules/inspections/components/PhotoQueueList";
import { useVehicle } from "@/modules/vehicles/hooks";
import { useCustomer } from "@/modules/crm/hooks";

export const Route = createModuleRoute("/inspections/$inspectionId/")({
  moduleId: "inspections",
  component: InspectionDetail,
});

function InspectionDetail() {
  const { inspectionId } = Route.useParams();
  const navigate = useNavigate();
  const repo = useInspectionsRepository();
  const { data: inspection, loading } = useInspection(inspectionId);
  const { data: findings } = useFindings(inspectionId);
  const { data: photos } = useInspectionPhotos(inspectionId);
  const { data: vehicle } = useVehicle(inspection?.vehicleId);
  const { data: customer } = useCustomer(inspection?.customerId);
  const canWrite = useHasCapability("inspections.write");
  const canPhoto = useHasCapability("inspections.photos.write");

  if (loading)
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!inspection)
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Inspection not found.</p>
        <Link to="/inspections" className="text-primary underline">
          Back to inspections
        </Link>
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {vehicle
              ? `${vehicle.year ? `${vehicle.year} ` : ""}${vehicle.make} ${vehicle.model}`
              : "Inspection"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {inspection.status.replace("_", " ")} ·{" "}
            {findings.length} finding{findings.length === 1 ? "" : "s"}
          </p>
          {customer && (
            <p className="mt-1 text-sm">
              Customer:{" "}
              <Link
                to="/customers/$customerId"
                params={{ customerId: customer.id }}
                className="text-primary underline"
              >
                {customer.displayName}
              </Link>
            </p>
          )}
          {inspection.notes && (
            <p className="mt-2 whitespace-pre-wrap rounded-md border border-border bg-card p-3 text-sm">
              {inspection.notes}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {canWrite && (
            <Button
              variant="outline"
              onClick={() =>
                navigate({
                  to: "/inspections/$inspectionId/edit",
                  params: { inspectionId },
                })
              }
            >
              <Pencil className="mr-1 h-4 w-4" /> Edit
            </Button>
          )}
          {canPhoto && (
            <Button
              variant="outline"
              onClick={async () => {
                await repo.queuePhoto({ inspectionId });
              }}
            >
              <Camera className="mr-1 h-4 w-4" /> Queue photo
            </Button>
          )}
        </div>
      </header>

      <section className="mb-8">
        <h2 className="mb-2 text-base font-medium">Findings ({findings.length})</h2>
        <div className="space-y-3">
          <FindingList
            findings={findings}
            onQueuePhoto={
              canPhoto
                ? async (findingId) => {
                    await repo.queuePhoto({ inspectionId, findingId });
                  }
                : undefined
            }
          />
          {canWrite && (
            <FindingForm
              inspectionId={inspectionId}
              onSubmit={async (input) => {
                await repo.createFinding(input);
              }}
            />
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-base font-medium">
          Photo queue ({photos.length})
        </h2>
        <PhotoQueueList photos={photos} />
      </section>
    </div>
  );
}
