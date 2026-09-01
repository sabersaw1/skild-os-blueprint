// Structured business context resolver (Phase 12).
//
// Turns a classified intent into a bounded set of read-only tool calls, and
// each returned record into a Fact carrying its EvidenceKind and source ids.
//
// This layer is the ONLY place that decides which slice of the OS an answer
// may rest on. It duplicates no record: a Fact holds a sentence plus the
// ids it came from, never a copy of the underlying entity.

import { newId } from "@/core/ids";
import { formatCents } from "@/core/money";
import {
  CapabilityDeniedError,
  RepositoryUnavailableError,
  ref,
  type JarvisTools,
} from "../tools";
import type {
  ClassifiedIntent,
  EvidenceKind,
  Fact,
  IntentType,
  KnowledgeCitation,
  SourceRef,
} from "../data/schemas";

export interface ResolvedContext {
  facts: Fact[];
  knowledge: KnowledgeCitation[];
  uncertainty: string[];
  blockedByCapabilities: string[];
}

export function fact(
  statement: string,
  kind: EvidenceKind,
  sources: SourceRef[] = [],
  extra: Partial<Pick<Fact, "value" | "unit">> = {},
): Fact {
  return { id: newId(), statement, kind, sources, ...extra };
}

class Collector {
  facts: Fact[] = [];
  knowledge: KnowledgeCitation[] = [];
  uncertainty: string[] = [];
  blocked: string[] = [];

  add(f: Fact) {
    this.facts.push(f);
  }

  /**
   * Runs a tool call. A capability denial or a missing repository becomes a
   * declared limitation, never a guess.
   */
  async run<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof CapabilityDeniedError) {
        if (!this.blocked.includes(e.capabilityId)) this.blocked.push(e.capabilityId);
        this.uncertainty.push(
          `${label} was not included: it requires the "${e.capabilityId}" capability.`,
        );
        return undefined;
      }
      if (e instanceof RepositoryUnavailableError) {
        this.uncertainty.push(
          `${label} is unavailable: no data source is registered for it.`,
        );
        return undefined;
      }
      throw e;
    }
  }

  result(): ResolvedContext {
    return {
      facts: this.facts,
      knowledge: this.knowledge,
      uncertainty: this.uncertainty,
      blockedByCapabilities: this.blocked,
    };
  }
}

const dayCount = (from: number, to: number) => Math.max(0, Math.floor((to - from) / 86_400_000));

export async function resolveContext(opts: {
  intent: ClassifiedIntent;
  question: string;
  tools: JarvisTools;
  now?: number;
  /** Optional explicit entity ids for the history/cost intents. */
  entityIds?: { customerId?: string; vehicleId?: string; jobId?: string };
}): Promise<ResolvedContext> {
  const { intent, tools, question } = opts;
  const now = opts.now ?? Date.now();
  const c = new Collector();
  const ids = opts.entityIds ?? {};

  const wanted = new Set<IntentType>([intent.type]);
  if (intent.type === "brief.daily") {
    ["operational.today", "leads.new", "leads.follow_up", "quotes.pending", "jobs.awaiting_parts", "finance.unpaid", "intelligence.overview"].forEach(
      (t) => wanted.add(t as IntentType),
    );
  }

  if (wanted.has("operational.today")) {
    const jobs = await c.run("Today's schedule", () => tools.getTodaySchedule(now));
    if (jobs) {
      c.add(
        fact(
          jobs.length === 0
            ? "No jobs are scheduled to start today"
            : `${jobs.length} job${jobs.length === 1 ? "" : "s"} scheduled today`,
          "system_derived",
          jobs.map((j) => ref("jobs", "job", j.id)),
          { value: jobs.length, unit: "count" },
        ),
      );
      for (const j of jobs) {
        c.add(fact(`Job "${j.title}" is ${j.status}`, "verified_fact", [ref("jobs", "job", j.id)]));
      }
    }
  }

  if (wanted.has("operational.upcoming")) {
    const jobs = await c.run("Upcoming jobs", () => tools.getUpcomingJobs(now));
    if (jobs) {
      c.add(
        fact(
          `${jobs.length} job${jobs.length === 1 ? "" : "s"} scheduled in the next 7 days`,
          "system_derived",
          jobs.map((j) => ref("jobs", "job", j.id)),
          { value: jobs.length, unit: "count" },
        ),
      );
    }
  }

  if (wanted.has("jobs.incomplete")) {
    const jobs = await c.run("Incomplete jobs", () => tools.getIncompleteJobs());
    if (jobs) {
      c.add(
        fact(
          `${jobs.length} job${jobs.length === 1 ? "" : "s"} are open (scheduled, in progress, or paused)`,
          "system_derived",
          jobs.map((j) => ref("jobs", "job", j.id)),
          { value: jobs.length, unit: "count" },
        ),
      );
      for (const j of jobs) {
        c.add(fact(`Job "${j.title}" is ${j.status}`, "verified_fact", [ref("jobs", "job", j.id)]));
      }
    }
  }

  if (wanted.has("jobs.awaiting_parts")) {
    const jobs = await c.run("Jobs awaiting parts", () => tools.getJobsAwaitingParts());
    if (jobs) {
      c.add(
        fact(
          jobs.length === 0
            ? "No paused job records a parts wait"
            : `${jobs.length} paused job${jobs.length === 1 ? "" : "s"} record a parts wait`,
          "system_derived",
          jobs.map((j) => ref("jobs", "job", j.id)),
          { value: jobs.length, unit: "count" },
        ),
      );
      if (jobs.length === 0) {
        c.uncertainty.push(
          "Skild OS has no dedicated \"awaiting parts\" state; this is derived from paused jobs whose notes mention parts.",
        );
      }
    }
  }

  if (wanted.has("leads.new")) {
    const leads = await c.run("New leads", () => tools.getNewLeads(now));
    if (leads) {
      c.add(
        fact(
          `${leads.length} new lead${leads.length === 1 ? "" : "s"} in the last 2 days`,
          "system_derived",
          leads.map((l) => ref("marketing", "lead", l.id)),
          { value: leads.length, unit: "count" },
        ),
      );
      for (const l of leads) {
        if (l.requestSummary || l.serviceRequested) {
          c.add(
            fact(
              `Lead asked about "${l.serviceRequested ?? l.requestSummary}" (customer-provided)`,
              "customer_provided",
              [ref("marketing", "lead", l.id)],
            ),
          );
        }
      }
    }
  }

  if (wanted.has("leads.follow_up")) {
    const stale = await c.run("Leads needing follow-up", () => tools.getStaleLeads(now));
    if (stale) {
      c.add(
        fact(
          `${stale.length} lead${stale.length === 1 ? "" : "s"} need follow-up`,
          "system_derived",
          stale.map((s) => ref("marketing", "lead", s.leadId)),
          { value: stale.length, unit: "count" },
        ),
      );
      for (const s of stale) {
        c.add(
          fact(
            `Lead untouched for ${dayCount(s.lastTouchedAt, now)} day(s) — ${s.reasons.join(", ")}`,
            "system_derived",
            [ref("marketing", "lead", s.leadId)],
            { value: dayCount(s.lastTouchedAt, now), unit: "days" },
          ),
        );
      }
    }
  }

  if (wanted.has("quotes.pending")) {
    const pending = await c.run("Pending quotes", () => tools.getPendingQuotes());
    if (pending) {
      c.add(
        fact(
          pending.length === 0
            ? "No quotes are awaiting a customer response"
            : `${pending.length} quote${pending.length === 1 ? "" : "s"} sent and awaiting a response`,
          "system_derived",
          pending.map((q) => ref("quotes", "quote", q.id)),
          { value: pending.length, unit: "count" },
        ),
      );
      for (const q of pending) {
        c.add(
          fact(
            `Quote "${q.title}" has been awaiting a response for ${dayCount(q.updatedAt, now)} day(s)`,
            "verified_fact",
            [ref("quotes", "quote", q.id), ref("crm", "customer", q.customerId)],
            { value: dayCount(q.updatedAt, now), unit: "days" },
          ),
        );
      }
    }
  }

  if (wanted.has("finance.unpaid")) {
    const invoices = await c.run("Unpaid invoices", () => tools.getUnpaidInvoices());
    if (invoices) {
      const balance = invoices.reduce((s, i) => s + i.balance, 0);
      c.add(
        fact(
          invoices.length === 0
            ? "No issued invoice has an outstanding balance"
            : `${invoices.length} unpaid invoice${invoices.length === 1 ? "" : "s"} totalling ${formatCents(balance)}`,
          "system_derived",
          invoices.map((i) => ref("finance", "invoice", i.id)),
          { value: balance, unit: "cents" },
        ),
      );
      for (const i of invoices) {
        c.add(
          fact(
            `Invoice ${i.number} has a balance of ${formatCents(i.balance)}`,
            "verified_fact",
            [ref("finance", "invoice", i.id)],
            { value: i.balance, unit: "cents" },
          ),
        );
      }
    }
  }

  if (wanted.has("finance.revenue")) {
    const totals = await c.run("Revenue", () => tools.getCollectedRevenue());
    if (totals) {
      c.add(
        fact(
          `${formatCents(totals.collectedCents)} recorded as paid across ${totals.invoiceCount} invoice(s)`,
          "system_derived",
          [],
          { value: totals.collectedCents, unit: "cents" },
        ),
      );
      c.add(
        fact(
          `${formatCents(totals.outstandingCents)} still outstanding`,
          "system_derived",
          [],
          { value: totals.outstandingCents, unit: "cents" },
        ),
      );
      c.uncertainty.push(
        "Revenue reflects payments recorded in Skild OS only. It is not an accounting statement and excludes anything never invoiced here.",
      );
    }
  }

  if (wanted.has("operational.attention")) {
    // Attention items are assembled by the attention engine; the service
    // attaches them. Nothing to resolve here.
  }

  if (wanted.has("parts.job_cost")) {
    if (!ids.jobId) {
      c.uncertainty.push(
        "No job was identified in the question, so no cost breakdown could be produced. Open the job and ask again from there.",
      );
    } else {
      const blockedBefore = c.blocked.length;
      const cost = await c.run("Job cost", () => tools.getJobCost(ids.jobId!));
      if (!cost) {
        if (c.blocked.length === blockedBefore) {
          c.uncertainty.push(
            "No cost breakdown could be produced for that job id — no such job record exists.",
          );
        }
      } else {
        c.add(
          fact(
            `Recorded parts cost is ${formatCents(cost.partsCostCents)} across ${cost.usageCount} usage record(s)`,
            "verified_fact",
            [ref("jobs", "job", cost.jobId)],
            { value: cost.partsCostCents, unit: "cents" },
          ),
        );
        c.add(
          fact(
            `${cost.laborHours} labor hour(s) logged, amounting to ${formatCents(cost.laborAmountCents)}`,
            "verified_fact",
            [ref("jobs", "job", cost.jobId)],
            { value: cost.laborHours, unit: "hours" },
          ),
        );
        if (cost.invoicedTotalCents !== undefined) {
          c.add(
            fact(
              `Invoiced total for this job is ${formatCents(cost.invoicedTotalCents)}`,
              "verified_fact",
              [ref("jobs", "job", cost.jobId)],
              { value: cost.invoicedTotalCents, unit: "cents" },
            ),
          );
        } else {
          c.uncertainty.push("No issued invoice is linked to this job, so profitability cannot be stated.");
        }
      }
    }
  }

  if (wanted.has("customer.history")) {
    if (!ids.customerId) {
      c.uncertainty.push(
        "No customer was identified in the question. Open the customer record and ask again from there.",
      );
    } else {
      const blockedBefore = c.blocked.length;
      const history = await c.run("Customer history", () => tools.getCustomerHistory(ids.customerId!));
      if (!history) {
        if (c.blocked.length === blockedBefore) {
          c.uncertainty.push("That customer could not be found in the CRM.");
        }
      } else {
        const src = [ref("crm", "customer", history.customer.id)];
        c.add(fact(`Customer is ${history.customer.displayName}`, "verified_fact", src));
        c.add(
          fact(
            `${history.vehicles.length} vehicle(s), ${history.jobs.length} job(s), ${history.quotes.length} quote(s), ${history.invoices.length} invoice(s) on record`,
            "system_derived",
            [
              ...src,
              ...history.vehicles.map((v) => ref("vehicles", "vehicle", v.id)),
              ...history.jobs.map((j) => ref("jobs", "job", j.id)),
            ],
          ),
        );
      }
    }
  }

  if (wanted.has("vehicle.history")) {
    if (!ids.vehicleId) {
      c.uncertainty.push(
        "No vehicle was identified in the question. Open the vehicle record and ask again from there.",
      );
    } else {
      const blockedBefore = c.blocked.length;
      const history = await c.run("Vehicle history", () => tools.getVehicleHistory(ids.vehicleId!));
      if (history) {
        const v = history.vehicle;
        c.add(
          fact(
            `Vehicle is a ${[v.year, v.make, v.model].filter(Boolean).join(" ")}`,
            "verified_fact",
            [ref("vehicles", "vehicle", v.id)],
          ),
        );
        c.add(
          fact(
            `${history.jobs.length} job(s) and ${history.partsUsage.length} parts usage record(s) on this vehicle`,
            "system_derived",
            [ref("vehicles", "vehicle", v.id), ...history.jobs.map((j) => ref("jobs", "job", j.id))],
          ),
        );
      } else if (c.blocked.length === blockedBefore) {
        c.uncertainty.push("That vehicle could not be found.");
      }
    }
  }

  if (wanted.has("marketing.performance")) {
    const perf = await c.run("Marketing performance", () => tools.getMarketingPerformance());
    if (perf) {
      for (const s of perf.sources) {
        c.add(
          fact(
            `Source "${s.source}": ${s.leads} lead(s), ${s.won} won, ${s.invoiced} invoiced`,
            "system_derived",
            [],
            { value: s.leads, unit: "count" },
          ),
        );
      }
      for (const s of perf.services) {
        c.add(
          fact(
            `Service "${s.service}": ${s.leads} lead(s), ${s.jobs} job(s)`,
            "system_derived",
            [],
            { value: s.leads, unit: "count" },
          ),
        );
      }
      if (perf.sources.length === 0 && perf.services.length === 0) {
        c.uncertainty.push("No lead records exist yet, so no marketing performance can be measured.");
      }
    }
  }

  if (wanted.has("marketing.opportunities")) {
    const opps = await c.run("Marketing opportunities", () => tools.getMarketingOpportunities());
    if (opps) {
      c.add(
        fact(
          `${opps.length} recorded marketing opportunit${opps.length === 1 ? "y" : "ies"}`,
          "system_derived",
          opps.map((o) => ref("marketing", "opportunity", o.id)),
          { value: opps.length, unit: "count" },
        ),
      );
      for (const o of opps) {
        c.add(
          fact(
            `${o.title} (${o.status}, evidence: ${o.evidenceSource})`,
            o.evidenceSource === "derived" ? "system_derived" : "verified_fact",
            [ref("marketing", "opportunity", o.id)],
          ),
        );
      }
    }
  }

  if (wanted.has("automation.status")) {
    const overview = await c.run("Automation overview", () =>
      tools.getAutomationOverview(),
    );
    if (overview) {
      c.add(
        fact(
          `${overview.activeAgents} active agent(s) and ${overview.activeAutomations} active automation rule(s)`,
          "system_derived",
          [],
          { value: overview.activeAgents, unit: "count" },
        ),
      );
      c.add(
        fact(
          `${overview.pendingApprovals} agent action(s) awaiting a human decision`,
          "system_derived",
          [],
          { value: overview.pendingApprovals, unit: "count" },
        ),
      );
      if (overview.failedRuns > 0) {
        c.add(
          fact(
            `${overview.failedRuns} agent run(s) failed and are still recorded as failed`,
            "system_derived",
            [],
            { value: overview.failedRuns, unit: "count" },
          ),
        );
      }
      if (overview.blockedActions > 0) {
        c.add(
          fact(
            `${overview.blockedActions} action(s) were refused by policy and will never execute automatically`,
            "system_derived",
            [],
            { value: overview.blockedActions, unit: "count" },
          ),
        );
      }
    }

    const runs = await c.run("Recent agent runs", () =>
      tools.getRecentAgentRuns(5),
    );
    if (runs) {
      for (const r of runs) {
        c.add(
          fact(
            `Run via ${r.trigger.source} finished as "${r.status}"${r.outcome ? `: ${r.outcome}` : ""}`,
            "system_derived",
            [],
          ),
        );
      }
      if (runs.length === 0) {
        c.uncertainty.push(
          "No agent has run yet, so there is no automation history to report.",
        );
      }
    }
  }

  if (wanted.has("intelligence.overview")) {
    const overview = await c.run("Business overview", () =>
      tools.getBusinessOverview(undefined, now),
    );
    if (overview) {
      for (const m of overview.metrics) {
        if (m.completeness === "unavailable") continue;
        const rendered =
          m.unit === "cents"
            ? formatCents(m.value)
            : m.unit === "ratio"
              ? `${(m.value * 100).toFixed(1)}%`
              : String(m.value);
        c.add(
          fact(
            `${m.metricId} for the last 30 days is ${rendered}`,
            "system_derived",
            [],
            { value: m.value, unit: m.unit === "cents" ? "cents" : "count" },
          ),
        );
        if (m.completeness === "partial" && m.limitation) {
          c.uncertainty.push(m.limitation);
        }
      }
      for (const l of overview.funnel.limitations) c.uncertainty.push(l);
      for (const l of overview.profitability.limitations) c.uncertainty.push(l);
      if (overview.unavailableModules.length > 0) {
        c.uncertainty.push(
          `These modules were unavailable, so the figures exclude them: ${overview.unavailableModules.join(", ")}.`,
        );
      }
      if (overview.metrics.every((m) => m.completeness === "unavailable")) {
        c.uncertainty.push(
          "No business records exist for this period, so no performance can be measured.",
        );
      }
    }
  }

  if (wanted.has("intelligence.findings")) {
    const findings = await c.run("Optimization findings", () =>
      tools.getIntelligenceFindings(),
    );
    if (findings) {
      for (const o of findings.observations) {
        c.add(
          fact(`${o.title}: ${o.description}`, "system_derived", [
            ref("intelligence", "observation", o.id),
          ]),
        );
      }
      for (const o of findings.opportunities) {
        c.add(
          fact(
            o.expectedImpactCents === undefined
              ? `${o.title} (no impact figure — the records do not support one)`
              : `${o.title} (estimated impact ${formatCents(o.expectedImpactCents)})`,
            "system_derived",
            [ref("intelligence", "opportunity", o.id)],
          ),
        );
      }
      for (const r of findings.recommendations) {
        c.add(
          fact(
            `Proposed: ${r.title} — ${r.reason}. A person must carry this out.`,
            "system_derived",
            [ref("intelligence", "recommendation", r.id)],
          ),
        );
      }
      const total =
        findings.observations.length +
        findings.opportunities.length +
        findings.recommendations.length;
      if (total === 0) {
        c.uncertainty.push(
          "No findings have been recorded yet. Run the optimization analysis on the Intelligence page to generate them.",
        );
      }
    }
  }

  if (wanted.has("knowledge.lookup") || intent.type === "knowledge.lookup") {
    const docs = await c.run("Business knowledge", () => tools.searchKnowledge(question));
    if (docs) {
      for (const d of docs) {
        c.knowledge.push({
          knowledgeId: d.id,
          title: d.title,
          type: d.type,
          versionNumber: d.versionNumber,
          summary: d.summary,
        });
      }
      if (docs.length === 0) {
        c.uncertainty.push(
          "No approved knowledge document matches this question. Skild OS will not improvise a policy.",
        );
      }
    }
  }

  if (intent.type === "unknown") {
    c.uncertainty.push(
      "This question was not recognised as a supported business query. Nothing was asserted; try asking about jobs, leads, quotes, parts, invoices, marketing, or a written policy.",
    );
  }

  return c.result();
}
