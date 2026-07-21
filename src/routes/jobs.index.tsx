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
import { useJobs } from "@/modules/jobs/hooks";
import { JobListItem } from "@/modules/jobs/components/JobListItem";
import {
  JOB_PRIORITIES,
  JOB_STATUSES,
  type JobPriority,
  type JobStatus,
} from "@/modules/jobs/data/schemas";
import { useVehicles } from "@/modules/vehicles/hooks";
import { useCustomers } from "@/modules/crm/hooks";

export const Route = createModuleRoute("/jobs/")({
  moduleId: "jobs",
  component: JobsIndex,
});

function JobsIndex() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<JobStatus | "all">("all");
  const [priority, setPriority] = useState<JobPriority | "all">("all");
  const [search, setSearch] = useState("");

  const query = useMemo(
    () => ({
      status: status === "all" ? undefined : status,
      priority: priority === "all" ? undefined : priority,
      search: search || undefined,
    }),
    [status, priority, search],
  );
  const { data, loading } = useJobs(query);
  const { data: vehicles } = useVehicles();
  const { data: customers } = useCustomers();
  const canWrite = useHasCapability("jobs.write");

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="text-xs text-muted-foreground">
            {data.length} job{data.length === 1 ? "" : "s"} ·{" "}
            <Link to="/quotes" className="text-primary underline">
              Quotes
            </Link>
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => navigate({ to: "/jobs/new" })}>
            <Plus className="mr-1 h-4 w-4" /> New job
          </Button>
        )}
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search title, description, or notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as typeof status)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {JOB_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={priority}
          onValueChange={(v) => setPriority(v as typeof priority)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {JOB_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
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
            No jobs yet.{" "}
            <Link to="/jobs/new" className="text-primary underline">
              Create your first one
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((j) => {
            const veh = vehicles.find((v) => v.id === j.vehicleId);
            const cust = customers.find((c) => c.id === j.customerId);
            return (
              <JobListItem
                key={j.id}
                job={j}
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
