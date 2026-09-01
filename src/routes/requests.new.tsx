import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import { useCommunicationRepository } from "@/modules/communication/hooks";
import {
  COMMUNICATION_CHANNELS,
  URGENCY_LEVELS,
  type CommunicationChannel,
  type UrgencyLevel,
} from "@/modules/communication/data/schemas";
import { useCustomers } from "@/modules/crm/hooks";

export const Route = createModuleRoute("/requests/new")({
  moduleId: "communication",
  head: () => ({
    meta: [
      { title: "Capture Service Request — Skild OS" },
      {
        name: "description",
        content:
          "Record a customer's service request with vehicle, problem description, timing, and urgency.",
      },
      { property: "og:title", content: "Capture Service Request — Skild OS" },
      {
        property: "og:description",
        content:
          "Structured intake so nothing about an inquiry is lost before it becomes a quote.",
      },
    ],
  }),
  component: NewRequest,
});

function NewRequest() {
  const navigate = useNavigate();
  const repo = useCommunicationRepository();
  const canWrite = useHasCapability("communication.write");
  const { data: customers } = useCustomers();

  const [customerId, setCustomerId] = useState("");
  const [requestedService, setRequestedService] = useState("");
  const [vehicleDescription, setVehicleDescription] = useState("");
  const [problemDescription, setProblemDescription] = useState("");
  const [location, setLocation] = useState("");
  const [preferredTiming, setPreferredTiming] = useState("");
  const [urgency, setUrgency] = useState<UrgencyLevel>("normal");
  const [channel, setChannel] = useState<CommunicationChannel>("website");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await repo.createServiceRequest({
        customerId: customerId || undefined,
        requestedService,
        vehicleDescription: vehicleDescription || undefined,
        problemDescription: problemDescription || undefined,
        location: location || undefined,
        preferredTiming: preferredTiming || undefined,
        urgency,
        channel,
      });
      void navigate({ to: "/requests" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save request.");
      setSaving(false);
    }
  }

  if (!canWrite) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        You do not have permission to capture service requests.
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">
        Capture service request
      </h1>
      <p className="mb-4 text-xs text-muted-foreground">
        Anything left blank is tracked as missing information instead of being
        guessed.
      </p>

      <form className="space-y-4" onSubmit={submit}>
        <div className="space-y-1">
          <Label htmlFor="service">Requested service</Label>
          <Input
            id="service"
            required
            value={requestedService}
            onChange={(e) => setRequestedService(e.target.value)}
            placeholder="Front brake pads and rotors"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="customer">Known customer (optional)</Label>
          <select
            id="customer"
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">Not yet identified</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="vehicle">Vehicle description</Label>
          <Input
            id="vehicle"
            value={vehicleDescription}
            onChange={(e) => setVehicleDescription(e.target.value)}
            placeholder="2016 Ford F-150, ~120k miles"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="problem">Problem description</Label>
          <Textarea
            id="problem"
            rows={3}
            value={problemDescription}
            onChange={(e) => setProblemDescription(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Denver, driveway"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="timing">Preferred timing</Label>
            <Input
              id="timing"
              value={preferredTiming}
              onChange={(e) => setPreferredTiming(e.target.value)}
              placeholder="Weekday mornings"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="urgency">Urgency</Label>
            <select
              id="urgency"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={urgency}
              onChange={(e) => setUrgency(e.target.value as UrgencyLevel)}
            >
              {URGENCY_LEVELS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="channel">Channel</Label>
            <select
              id="channel"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={channel}
              onChange={(e) =>
                setChannel(e.target.value as CommunicationChannel)
              }
            >
              {COMMUNICATION_CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button type="submit" disabled={saving || !requestedService.trim()}>
            {saving ? "Saving…" : "Capture request"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate({ to: "/requests" })}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
