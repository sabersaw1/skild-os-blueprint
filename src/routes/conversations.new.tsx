import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import { useCommunicationRepository } from "@/modules/communication/hooks";
import {
  COMMUNICATION_CHANNELS,
  type CommunicationChannel,
} from "@/modules/communication/data/schemas";
import { useCustomers } from "@/modules/crm/hooks";
import { useVehicles } from "@/modules/vehicles/hooks";

export const Route = createModuleRoute("/conversations/new")({
  moduleId: "communication",
  head: () => ({
    meta: [
      { title: "New Conversation — Skild OS" },
      {
        name: "description",
        content:
          "Open a customer conversation thread against an existing customer and vehicle record.",
      },
      { property: "og:title", content: "New Conversation — Skild OS" },
      {
        property: "og:description",
        content:
          "Start a channel-agnostic customer thread linked to existing Skild OS records.",
      },
    ],
  }),
  component: NewConversation,
});

function NewConversation() {
  const navigate = useNavigate();
  const repo = useCommunicationRepository();
  const canWrite = useHasCapability("communication.write");
  const { data: customers } = useCustomers();
  const { data: vehicles } = useVehicles();

  const [customerId, setCustomerId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [channel, setChannel] = useState<CommunicationChannel>("website");
  const [subject, setSubject] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const vehicleOptions = vehicles.filter(
    (v) => !customerId || v.customerId === customerId,
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const created = await repo.createConversation({
        customerId,
        vehicleId: vehicleId || undefined,
        channel,
        subject: subject || undefined,
        source: source || undefined,
      });
      void navigate({
        to: "/conversations/$conversationId",
        params: { conversationId: created.id },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open thread.");
      setSaving(false);
    }
  }

  if (!canWrite) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        You do not have permission to create conversations.
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">
        New conversation
      </h1>
      <p className="mb-4 text-xs text-muted-foreground">
        Threads reference existing customer and vehicle records. No duplicate
        customer data is created here.
      </p>

      <form className="space-y-4" onSubmit={submit}>
        <div className="space-y-1">
          <Label htmlFor="customer">Customer</Label>
          <select
            id="customer"
            required
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              setVehicleId("");
            }}
          >
            <option value="">Select a customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="vehicle">Vehicle (optional)</Label>
          <select
            id="vehicle"
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
          >
            <option value="">No specific vehicle</option>
            {vehicleOptions.map((v) => (
              <option key={v.id} value={v.id}>
                {[v.year, v.make, v.model].filter(Boolean).join(" ")}
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

        <div className="space-y-1">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brake noise on the F-150"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="source">Source</Label>
          <Input
            id="source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="website.contact-form"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button type="submit" disabled={saving || !customerId}>
            {saving ? "Opening…" : "Open thread"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate({ to: "/conversations" })}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
