import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import {
  useCommunicationRepository,
  useServiceRequests,
} from "@/modules/communication/hooks";
import {
  QUALIFICATION_STATUSES,
  type QualificationStatus,
} from "@/modules/communication/data/schemas";
import { formatDenver } from "@/modules/communication/data/time";

export const Route = createModuleRoute("/requests/")({
  moduleId: "communication",
  head: () => ({
    meta: [
      { title: "Intake Queue — Skild OS" },
      {
        name: "description",
        content:
          "Every captured service request with its qualification state and missing information.",
      },
      { property: "og:title", content: "Intake Queue — Skild OS" },
      {
        property: "og:description",
        content:
          "Track qualification of incoming service requests from every channel.",
      },
    ],
  }),
  component: RequestsIndex,
});

function RequestsIndex() {
  const navigate = useNavigate();
  const repo = useCommunicationRepository();
  const { data, loading } = useServiceRequests();
  const canRead = useHasCapability("communication.read");
  const canWrite = useHasCapability("communication.write");

  if (!canRead) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        You do not have permission to view service requests.
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Service requests
          </h1>
          <p className="text-xs text-muted-foreground">
            {data.length} captured · structured intake, no lead generation
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => navigate({ to: "/requests/new" })}>
            <Plus className="mr-1 h-4 w-4" /> Capture request
          </Button>
        )}
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No service requests captured yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {data.map((r) => (
            <li
              key={r.id}
              className="rounded-md border border-border p-3 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{r.requestedService}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.channel} · urgency {r.urgency} ·{" "}
                    {formatDenver(r.createdAt)}
                  </p>
                  {r.vehicleDescription && (
                    <p className="text-xs text-muted-foreground">
                      vehicle: {r.vehicleDescription}
                    </p>
                  )}
                  {r.missingInformation.length > 0 && (
                    <p className="mt-1 text-xs text-destructive">
                      missing: {r.missingInformation.join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="secondary">
                    {r.qualificationStatus.replace("_", " ")}
                  </Badge>
                  {canWrite && (
                    <select
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      value={r.qualificationStatus}
                      onChange={(e) =>
                        void repo.updateServiceRequest(r.id, {
                          qualificationStatus: e.target
                            .value as QualificationStatus,
                        })
                      }
                    >
                      {QUALIFICATION_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              {r.problemDescription && (
                <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                  {r.problemDescription}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
