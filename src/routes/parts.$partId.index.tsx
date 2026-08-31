import { Link, useNavigate } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import {
  usePart,
  usePartUsage,
  usePartVehicleReferences,
  usePartsRepository,
  useSuppliers,
} from "@/modules/parts/hooks";
import { formatCents } from "@/modules/parts/data/money";
import { PartUsageForm } from "@/modules/parts/components/PartUsageForm";
import { useVehicles } from "@/modules/vehicles/hooks";
import { useJobs } from "@/modules/jobs/hooks";

export const Route = createModuleRoute("/parts/$partId/")({
  moduleId: "parts",
  component: PartDetail,
});

function PartDetail() {
  const { partId } = Route.useParams();
  const navigate = useNavigate();
  const repo = usePartsRepository();
  const { data: part, loading } = usePart(partId);
  const { data: suppliers } = useSuppliers();
  const { data: usage } = usePartUsage({ partId });
  const { data: refs } = usePartVehicleReferences(partId);
  const { data: vehicles } = useVehicles();
  const { data: jobs } = useJobs();
  const canWrite = useHasCapability("parts.write");
  const canUsage = useHasCapability("parts.usage.write");

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  }
  if (!part) {
    return <p className="p-6 text-sm text-muted-foreground">Part not found.</p>;
  }

  const vehicleLabel = (id: string) => {
    const v = vehicles.find((x) => x.id === id);
    return v ? `${v.year ? `${v.year} ` : ""}${v.make} ${v.model}` : id;
  };
  const totalSpend = usage.reduce((s, u) => s + u.totalCost, 0);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{part.name}</h1>
          <p className="text-xs text-muted-foreground">
            {[part.partNumber, part.brand ?? part.manufacturer, part.category]
              .filter(Boolean)
              .join(" · ") || "No part number"}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Badge
              variant={part.status === "active" ? "default" : "secondary"}
            >
              {part.status}
            </Badge>
            {part.preferredSupplierId && (
              <span className="text-xs text-muted-foreground">
                Preferred:{" "}
                {suppliers.find((s) => s.id === part.preferredSupplierId)
                  ?.name ?? "Unknown"}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {canWrite && (
            <Button
              variant="outline"
              onClick={() =>
                navigate({ to: "/parts/$partId/edit", params: { partId } })
              }
            >
              <Pencil className="mr-1 h-4 w-4" /> Edit
            </Button>
          )}
          <Button variant="ghost" asChild>
            <Link to="/parts">Back</Link>
          </Button>
        </div>
      </header>

      {part.description && (
        <p className="mb-4 whitespace-pre-wrap text-sm">{part.description}</p>
      )}

      <Separator className="my-4" />

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold">
          Usage history · {formatCents(totalSpend)} total
        </h2>
        {usage.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This part has not been used yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {usage.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between rounded-md border p-2 text-sm"
              >
                <span className="truncate">
                  {vehicleLabel(u.vehicleId)}
                  {u.jobId ? " · job linked" : ""}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {u.quantity} × {formatCents(u.unitCost)} ={" "}
                  {formatCents(u.totalCost)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canUsage && (
        <section className="mb-6 rounded-md border p-4">
          <h2 className="mb-3 text-sm font-semibold">Record usage</h2>
          <PartUsageForm
            partId={partId}
            vehicles={vehicles.map((v) => ({
              id: v.id,
              label: `${v.year ? `${v.year} ` : ""}${v.make} ${v.model}`,
            }))}
            jobs={jobs.map((j) => ({ id: j.id, label: j.title }))}
            onSubmit={async (input) => {
              await repo.recordUsage(input);
            }}
          />
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold">Fits vehicles</h2>
        {refs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No vehicle references recorded.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {refs.map((r) => (
              <li key={r.id}>{vehicleLabel(r.vehicleId)}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
