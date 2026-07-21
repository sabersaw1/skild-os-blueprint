import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeftRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVehicle, useVehicleRepository } from "@/modules/vehicles/hooks";
import { useCustomer, useCustomers } from "@/modules/crm/hooks";
import type { OwnershipRecord } from "@/modules/vehicles/data/repository";

export const Route = createFileRoute("/vehicles/$vehicleId/")({
  component: VehicleDetail,
});

function VehicleDetail() {
  const { vehicleId } = Route.useParams();
  const navigate = useNavigate();
  const repo = useVehicleRepository();
  const { data: vehicle, loading } = useVehicle(vehicleId);
  const { data: owner } = useCustomer(vehicle?.customerId);
  const { data: customers } = useCustomers();
  const [history, setHistory] = useState<OwnershipRecord[]>([]);
  const [transferTo, setTransferTo] = useState("");

  useEffect(() => {
    void repo.listOwnershipHistory(vehicleId).then(setHistory);
  }, [repo, vehicleId, vehicle?.customerId]);

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!vehicle)
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Vehicle not found.</p>
        <Link to="/vehicles" className="text-primary underline">Back to vehicles</Link>
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {vehicle.year ? `${vehicle.year} ` : ""}
            {vehicle.make} {vehicle.model}
          </h1>
          <p className="text-sm text-muted-foreground">
            {vehicle.licensePlate || "no plate"} · VIN {vehicle.vin || "—"}
          </p>
          {owner && (
            <p className="mt-1 text-sm">
              Owner:{" "}
              <Link
                to="/customers/$customerId"
                params={{ customerId: owner.id }}
                className="text-primary underline"
              >
                {owner.displayName}
              </Link>
            </p>
          )}
        </div>
        <Button
          variant="outline"
          onClick={() =>
            navigate({ to: "/vehicles/$vehicleId/edit", params: { vehicleId } })
          }
        >
          <Pencil className="mr-1 h-4 w-4" /> Edit
        </Button>
      </header>

      <section className="mb-8 rounded-md border border-border bg-card p-4">
        <h2 className="mb-2 text-base font-medium">Transfer ownership</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={transferTo} onValueChange={setTransferTo}>
            <SelectTrigger className="min-w-[220px]">
              <SelectValue placeholder="Select new owner" />
            </SelectTrigger>
            <SelectContent>
              {customers
                .filter((c) => c.id !== vehicle.customerId)
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.displayName}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button
            disabled={!transferTo}
            onClick={async () => {
              await repo.transferOwnership(vehicleId, transferTo, "transferred");
              setTransferTo("");
            }}
          >
            <ArrowLeftRight className="mr-1 h-4 w-4" /> Transfer
          </Button>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-base font-medium">Ownership history</h2>
        <ul className="space-y-2">
          {history.map((r) => (
            <li key={r.id} className="rounded-md border border-border bg-card p-3 text-sm">
              <span className="font-medium">{r.reason ?? "held"}</span>
              <span className="text-muted-foreground">
                {" "}
                — from {new Date(r.fromDate).toLocaleDateString()}
                {r.toDate ? ` to ${new Date(r.toDate).toLocaleDateString()}` : " (current)"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
