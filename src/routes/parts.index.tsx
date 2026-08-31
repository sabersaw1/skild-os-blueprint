import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import { useParts, useSuppliers } from "@/modules/parts/hooks";
import { PartListItem } from "@/modules/parts/components/PartListItem";
import {
  PartSearch,
  type PartSearchValue,
} from "@/modules/parts/components/PartSearch";

export const Route = createModuleRoute("/parts/")({
  moduleId: "parts",
  component: PartsIndex,
});

function PartsIndex() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<PartSearchValue>({
    search: "",
    status: "all",
    brand: "",
    category: "",
  });

  const query = useMemo(
    () => ({
      search: filters.search || undefined,
      status: filters.status === "all" ? undefined : filters.status,
      brand: filters.brand || undefined,
      category: filters.category || undefined,
    }),
    [filters],
  );

  const { data, loading } = useParts(query);
  const { data: suppliers } = useSuppliers();
  const canWrite = useHasCapability("parts.write");

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Parts</h1>
          <p className="text-xs text-muted-foreground">
            {data.length} part{data.length === 1 ? "" : "s"} ·{" "}
            <Link to="/purchases/parts" className="text-primary underline">
              Purchases
            </Link>{" "}
            ·{" "}
            <Link to="/suppliers/parts" className="text-primary underline">
              Suppliers
            </Link>
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => navigate({ to: "/parts/new" })}>
            <Plus className="mr-1 h-4 w-4" /> New part
          </Button>
        )}
      </header>

      <PartSearch value={filters} onChange={setFilters} />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No parts found.{" "}
            <Link to="/parts/new" className="text-primary underline">
              Add one
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((p) => (
            <PartListItem
              key={p.id}
              part={p}
              supplierLabel={
                suppliers.find((s) => s.id === p.preferredSupplierId)?.name
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
