import { Link } from "@tanstack/react-router";
import { Car } from "lucide-react";
import type { Vehicle } from "../data/repository";

export function VehicleListItem({ vehicle }: { vehicle: Vehicle }) {
  return (
    <Link
      to="/vehicles/$vehicleId"
      params={{ vehicleId: vehicle.id }}
      className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2 transition-colors hover:bg-accent"
    >
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Car className="h-4 w-4" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block truncate text-sm font-medium">
          {vehicle.year ? `${vehicle.year} ` : ""}
          {vehicle.make} {vehicle.model}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {vehicle.licensePlate || vehicle.vin || "—"}
        </span>
      </span>
    </Link>
  );
}
