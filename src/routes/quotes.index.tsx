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
import { useHasCapability } from "@/core/roles/hooks";
import { useQuotes } from "@/modules/quotes/hooks";
import { QuoteListItem } from "@/modules/quotes/components/QuoteListItem";
import {
  QUOTE_STATUSES,
  type QuoteStatus,
} from "@/modules/quotes/data/schemas";
import { useVehicles } from "@/modules/vehicles/hooks";
import { useCustomers } from "@/modules/crm/hooks";

export const Route = createModuleRoute("/quotes/")({
  moduleId: "quotes",
  component: QuotesIndex,
});

function QuotesIndex() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<QuoteStatus | "all">("all");
  const [search, setSearch] = useState("");

  const query = useMemo(
    () => ({
      status: status === "all" ? undefined : status,
      search: search || undefined,
    }),
    [status, search],
  );
  const { data, loading } = useQuotes(query);
  const { data: vehicles } = useVehicles();
  const { data: customers } = useCustomers();
  const canWrite = useHasCapability("quotes.write");

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quotes</h1>
          <p className="text-xs text-muted-foreground">
            {data.length} quote{data.length === 1 ? "" : "s"} ·{" "}
            <Link to="/inspections" className="text-primary underline">
              Inspections
            </Link>
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => navigate({ to: "/quotes/new" })}>
            <Plus className="mr-1 h-4 w-4" /> New quote
          </Button>
        )}
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search title or notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as typeof status)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {QUOTE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
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
            No quotes yet.{" "}
            <Link to="/quotes/new" className="text-primary underline">
              Draft your first one
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((q) => {
            const veh = vehicles.find((v) => v.id === q.vehicleId);
            const cust = customers.find((c) => c.id === q.customerId);
            return (
              <QuoteListItem
                key={q.id}
                quote={q}
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
