import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import { useMarketingRepository } from "@/modules/marketing/hooks";
import {
  LEAD_CHANNELS,
  LEAD_SOURCES,
  LEAD_URGENCIES,
  type LeadChannel,
  type LeadSource,
  type LeadUrgency,
} from "@/modules/marketing/data/schemas";

export const Route = createModuleRoute("/leads/new")({
  moduleId: "marketing",
  head: () => ({
    meta: [
      { title: "Record a Lead — Skild OS" },
      {
        name: "description",
        content:
          "Record a real inquiry with its source attribution so it can be qualified, quoted, and measured.",
      },
      { property: "og:title", content: "Record a Lead — Skild OS" },
      {
        property: "og:description",
        content:
          "Capture a genuine inquiry and where it came from. Skild OS never fabricates leads.",
      },
    ],
  }),
  component: NewLead,
});

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

function NewLead() {
  const navigate = useNavigate();
  const repo = useMarketingRepository();
  const canWrite = useHasCapability("leads.write");

  const [channel, setChannel] = useState<LeadChannel>("website_form");
  const [source, setSource] = useState<LeadSource>("website");
  const [sourceDetail, setSourceDetail] = useState("");
  const [medium, setMedium] = useState("");
  const [campaign, setCampaign] = useState("");
  const [landingPage, setLandingPage] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [serviceRequested, setServiceRequested] = useState("");
  const [requestSummary, setRequestSummary] = useState("");
  const [location, setLocation] = useState("");
  const [urgency, setUrgency] = useState<LeadUrgency>("normal");
  const [customerId, setCustomerId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!canWrite) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        You do not have permission to record leads.
      </p>
    );
  }

  const submit = async () => {
    setError(null);
    setSaving(true);
    try {
      const lead = await repo.createLead({
        channel,
        serviceRequested: serviceRequested || undefined,
        requestSummary: requestSummary || undefined,
        location: location || undefined,
        urgency,
        customerId: customerId || undefined,
        vehicleId: vehicleId || undefined,
        conversationId: conversationId || undefined,
        attribution: {
          source,
          sourceDetail: sourceDetail || undefined,
          medium: medium || undefined,
          campaign: campaign || undefined,
          landingPage: landingPage || undefined,
          referralSource: referralSource || undefined,
        },
      });
      void navigate({ to: "/leads/$leadId", params: { leadId: lead.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Record a lead</h1>
      <p className="mb-4 text-xs text-muted-foreground">
        Only real inquiries. Existing customers and vehicles are referenced by
        id — never duplicated here.
      </p>

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="channel">Channel</Label>
            <select
              id="channel"
              className={selectClass}
              value={channel}
              onChange={(e) => setChannel(e.target.value as LeadChannel)}
            >
              {LEAD_CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="source">Source</Label>
            <select
              id="source"
              className={selectClass}
              value={source}
              onChange={(e) => setSource(e.target.value as LeadSource)}
            >
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Label htmlFor="service">Service requested</Label>
          <Input
            id="service"
            value={serviceRequested}
            onChange={(e) => setServiceRequested(e.target.value)}
            placeholder="Brake repair"
          />
        </div>

        <div>
          <Label htmlFor="summary">Request summary</Label>
          <Textarea
            id="summary"
            value={requestSummary}
            onChange={(e) => setRequestSummary(e.target.value)}
            placeholder="What the customer described, in their words."
            rows={3}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="urgency">Urgency</Label>
            <select
              id="urgency"
              className={selectClass}
              value={urgency}
              onChange={(e) => setUrgency(e.target.value as LeadUrgency)}
            >
              {LEAD_URGENCIES.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="rounded-md border border-border p-3">
          <legend className="px-1 text-xs text-muted-foreground">
            Attribution
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="medium">Medium</Label>
              <Input
                id="medium"
                value={medium}
                onChange={(e) => setMedium(e.target.value)}
                placeholder="organic"
              />
            </div>
            <div>
              <Label htmlFor="campaign">Campaign</Label>
              <Input
                id="campaign"
                value={campaign}
                onChange={(e) => setCampaign(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="landing">Landing page</Label>
              <Input
                id="landing"
                value={landingPage}
                onChange={(e) => setLandingPage(e.target.value)}
                placeholder="/services/brake-repair"
              />
            </div>
            <div>
              <Label htmlFor="referral">Referral source</Label>
              <Input
                id="referral"
                value={referralSource}
                onChange={(e) => setReferralSource(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="detail">Source detail</Label>
              <Input
                id="detail"
                value={sourceDetail}
                onChange={(e) => setSourceDetail(e.target.value)}
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="rounded-md border border-border p-3">
          <legend className="px-1 text-xs text-muted-foreground">
            Existing records (references only)
          </legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="customerId">Customer id</Label>
              <Input
                id="customerId"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="vehicleId">Vehicle id</Label>
              <Input
                id="vehicleId"
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="conversationId">Conversation id</Label>
              <Input
                id="conversationId"
                value={conversationId}
                onChange={(e) => setConversationId(e.target.value)}
              />
            </div>
          </div>
        </fieldset>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button disabled={saving} onClick={() => void submit()}>
            {saving ? "Saving…" : "Record lead"}
          </Button>
          <Button variant="ghost" onClick={() => navigate({ to: "/leads" })}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
