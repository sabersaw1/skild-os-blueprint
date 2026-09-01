import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import { useLead, useMarketingRepository } from "@/modules/marketing/hooks";
import { formatDenver } from "@/modules/communication/data/time";
import {
  LEAD_LOST_REASONS,
  LEAD_QUALIFICATIONS,
  LEAD_TRANSITIONS,
  type LeadChain,
  type LeadLostReason,
  type LeadQualification,
} from "@/modules/marketing/data/schemas";

export const Route = createModuleRoute("/leads/$leadId")({
  moduleId: "marketing",
  head: () => ({
    meta: [
      { title: "Lead Detail — Skild OS" },
      {
        name: "description",
        content:
          "One lead: attribution, qualification, follow-up, and the quote/job/invoice chain it produced.",
      },
      { property: "og:title", content: "Lead Detail — Skild OS" },
      {
        property: "og:description",
        content:
          "Trace a single inquiry from source through qualification to revenue.",
      },
    ],
  }),
  component: LeadDetail,
});

const selectClass =
  "h-9 rounded-md border border-input bg-background px-2 text-sm";

function LeadDetail() {
  const { leadId } = useParams({ from: "/leads/$leadId" });
  const navigate = useNavigate();
  const repo = useMarketingRepository();
  const { data: lead, loading, refresh } = useLead(leadId);
  const canWrite = useHasCapability("leads.write");

  const [chain, setChain] = useState<LeadChain | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [lostReason, setLostReason] = useState<LeadLostReason>("no_response");
  const [followUp, setFollowUp] = useState("");
  const [quoteId, setQuoteId] = useState("");
  const [jobId, setJobId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");

  useEffect(() => {
    void repo.getLeadChain(leadId).then(setChain);
  }, [repo, leadId, lead?.updatedAt]);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  }
  if (!lead) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Lead not found.</p>
        <Button
          variant="ghost"
          className="mt-2"
          onClick={() => navigate({ to: "/leads" })}
        >
          Back to leads
        </Button>
      </div>
    );
  }

  const nextStatuses = LEAD_TRANSITIONS[lead.status] ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
      <header>
        <Link to="/leads" className="text-xs text-muted-foreground hover:underline">
          ← Leads
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {lead.serviceRequested ?? "Unspecified service"}
        </h1>
        <div className="mt-2 flex flex-wrap gap-1">
          <Badge variant="secondary">{lead.status.replace(/_/g, " ")}</Badge>
          <Badge variant="outline">
            awaiting {lead.awaitingParty.replace(/_/g, " ")}
          </Badge>
          <Badge variant="outline">{lead.qualification.replace(/_/g, " ")}</Badge>
          <Badge variant="outline">score {lead.score}</Badge>
        </div>
      </header>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <section className="rounded-md border border-border p-3 text-sm">
        <h2 className="mb-2 font-medium">Request</h2>
        {lead.requestSummary && <p className="mb-2">{lead.requestSummary}</p>}
        <dl className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
          <dt>Channel</dt>
          <dd>{lead.channel.replace(/_/g, " ")}</dd>
          <dt>Urgency</dt>
          <dd>{lead.urgency ?? "—"}</dd>
          <dt>Location</dt>
          <dd>{lead.location ?? "—"}</dd>
          <dt>Created</dt>
          <dd>{formatDenver(lead.createdAt)}</dd>
          <dt>Last contact</dt>
          <dd>
            {lead.lastContactAt ? formatDenver(lead.lastContactAt) : "never"}
          </dd>
          <dt>Next follow-up</dt>
          <dd>
            {lead.nextFollowUpAt ? formatDenver(lead.nextFollowUpAt) : "—"}
          </dd>
        </dl>
      </section>

      <section className="rounded-md border border-border p-3 text-sm">
        <h2 className="mb-2 font-medium">Attribution</h2>
        <dl className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
          <dt>First touch</dt>
          <dd>
            {lead.attribution.firstTouch.source.replace(/_/g, " ")} ·{" "}
            {formatDenver(lead.attribution.firstTouch.at)}
          </dd>
          <dt>Last touch</dt>
          <dd>
            {lead.attribution.lastTouch.source.replace(/_/g, " ")} ·{" "}
            {formatDenver(lead.attribution.lastTouch.at)}
          </dd>
          <dt>Campaign</dt>
          <dd>{lead.attribution.lastTouch.campaign ?? "—"}</dd>
          <dt>Landing page</dt>
          <dd>{lead.attribution.lastTouch.landingPage ?? "—"}</dd>
        </dl>
      </section>

      <section className="rounded-md border border-border p-3 text-sm">
        <h2 className="mb-2 font-medium">Why this score</h2>
        <ul className="list-inside list-disc text-xs text-muted-foreground">
          {lead.scoreReasons.length === 0 ? (
            <li>No scoring signals recorded.</li>
          ) : (
            lead.scoreReasons.map((r) => <li key={r}>{r}</li>)
          )}
        </ul>
      </section>

      <section className="rounded-md border border-border p-3 text-sm">
        <h2 className="mb-2 font-medium">Chain</h2>
        <dl className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
          <dt>Customer</dt>
          <dd>{chain?.customerId ?? "—"}</dd>
          <dt>Vehicle</dt>
          <dd>{chain?.vehicleId ?? "—"}</dd>
          <dt>Conversation</dt>
          <dd>{chain?.conversationId ?? "—"}</dd>
          <dt>Quote</dt>
          <dd>{chain?.quoteId ?? "—"}</dd>
          <dt>Job</dt>
          <dd>{chain?.jobId ?? "—"}</dd>
          <dt>Invoice</dt>
          <dd>{chain?.invoiceId ?? "—"}</dd>
        </dl>
      </section>

      {canWrite && (
        <section className="space-y-4 rounded-md border border-border p-3">
          <div>
            <h2 className="mb-2 text-sm font-medium">Lifecycle</h2>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void run(() => repo.recordContact(lead.id))}
              >
                Log contact
              </Button>
              {nextStatuses
                .filter((s) => s !== "lost")
                .map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant="secondary"
                    onClick={() => void run(() => repo.setLeadStatus(lead.id, s))}
                  >
                    {s.replace(/_/g, " ")}
                  </Button>
                ))}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="qualification" className="text-xs">
                Qualification
              </Label>
              <select
                id="qualification"
                className={selectClass}
                value={lead.qualification}
                onChange={(e) =>
                  void run(() =>
                    repo.setQualification(
                      lead.id,
                      e.target.value as LeadQualification,
                    ),
                  )
                }
              >
                {LEAD_QUALIFICATIONS.map((q) => (
                  <option key={q} value={q}>
                    {q.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="followUp" className="text-xs">
                Follow-up
              </Label>
              <Input
                id="followUp"
                type="datetime-local"
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                className="h-9"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void run(() =>
                  repo.scheduleFollowUp(
                    lead.id,
                    followUp ? new Date(followUp).getTime() : null,
                  ),
                )
              }
            >
              {followUp ? "Set follow-up" : "Clear follow-up"}
            </Button>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-medium">Link conversions</h2>
            <div className="flex flex-wrap items-end gap-2">
              <Input
                placeholder="Quote id"
                value={quoteId}
                onChange={(e) => setQuoteId(e.target.value)}
                className="h-9 w-40"
              />
              <Input
                placeholder="Job id"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                className="h-9 w-40"
              />
              <Input
                placeholder="Invoice id"
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
                className="h-9 w-40"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void run(async () => {
                    await repo.recordConversion(lead.id, {
                      quoteId: quoteId || undefined,
                      jobId: jobId || undefined,
                      invoiceId: invoiceId || undefined,
                    });
                    setQuoteId("");
                    setJobId("");
                    setInvoiceId("");
                  })
                }
              >
                Link
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="lostReason" className="text-xs">
                Lost reason
              </Label>
              <select
                id="lostReason"
                className={selectClass}
                value={lostReason}
                onChange={(e) =>
                  setLostReason(e.target.value as LeadLostReason)
                }
              >
                {LEAD_LOST_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => void run(() => repo.markLost(lead.id, lostReason))}
            >
              Mark lost
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
