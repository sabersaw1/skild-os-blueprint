import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/roles";
import { useInspections } from "@/modules/inspections/hooks";
import { InspectionListItem } from "@/modules/inspections/components/InspectionListItem";
import {
  INSPECTION_STATUSES,
  type InspectionStatus,
} from "@/modules/inspections/data/schemas";
import { useVehicles } from "@/modules/vehicles/hooks";
import { useCustomers } from "@/modules/crm/hooks";

export const Route = createModuleRoute("/inspections/")({
  moduleId: "inspections",
  component: InspectionsIndex,
});

function InspectionsIndex() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<InspectionStatus | "all">("all");
  const [search, setSearch] = useState("");

  const query = useMemo(
    () => ({
      status: status === "all" ? undefined : status,
      search: search || undefined,
    }),
    [status, search],
  );
  const { data, loading } = useInspections(query);
  const { data: vehicles } = useVehicles();
  const { data: customers } = useCustomers();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inspections</h1>
          <p className="text-xs text-muted-foreground">
            {data.length} inspection{data.length === 1 ? "" : "s"} ·{" "}
            <Link
              to="/templates/inspections"
              className="text-primary underline"
            >
              Templates
            </Link>
          </p>
        </div>
        <Button onClick={() => navigate({ to: "/inspections/new" })}>
          <Plus className="mr-1 h-4 w-4" /> New inspection
        </Button>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {INSPECTION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No inspections yet.{" "}
            <Link to="/inspections/new" className="text-primary underline">
              Start your first one
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((i) => {
            const veh = vehicles.find((v) => v.id === i.vehicleId);
            const cust = customers.find((c) => c.id === i.customerId);
            return (
              <InspectionListItem
                key={i.id}
                inspection={i}
                vehicleLabel={
                  veh
                    ? `${veh.year ? `${veh.year} ` : ""}${veh.make} ${veh.model}`
                    : undefined
                }
                customerLabel={cust?.displayName}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
