// Deterministic metric engine (Phase 14).
//
// Everything in this file is a PURE function over an in-memory dataset.
// No storage, no registry, no clock beyond what the caller passes, no LLM.
// The same dataset always produces the same numbers — that is what makes a
// metric snapshot reproducible and an observation explainable.
//
// Money is integer cents throughout.

import type { Lead } from "@/modules/marketing/data/schemas";
import type { Quote } from "@/modules/quotes/data/schemas";
import type { Job, LaborEntry } from "@/modules/jobs/data/schemas";
import type { Invoice, Payment } from "@/modules/finance/data/schemas";
import type { PartUsage } from "@/modules/parts/data/schemas";
import { laborTotalCents } from "@/core/money";
import type {
  AttentionItem,
  DataCompleteness,
  Evidence,
  ExpectedVsActualRow,
  FunnelReport,
  FunnelStage,
  FunnelStageId,
  MetricComputation,
  MetricDefinition,
  Period,
  ProfitabilityReport,
  ServicePerformanceRow,
  SourcePerformanceRow,
  SourceRef,
} from "./schemas";

export const DAY_MS = 86_400_000;

// ---- Dataset ------------------------------------------------------------

/**
 * A period-scoped snapshot of authoritative records, read through the Data
 * Registry by ./read-models.ts. BI never stores these records — the dataset
 * exists only for the duration of one calculation.
 */
export interface IntelligenceDataset {
  period: Period;
  now: number;
  leads: Lead[];
  quotes: Quote[];
  jobs: Job[];
  laborByJob: Record<string, LaborEntry[]>;
  invoices: Invoice[];
  payments: Payment[];
  partsUsage: PartUsage[];
  /** Repositories that were not registered when the dataset was built. */
  unavailableModules: string[];
}

export function emptyDataset(period: Period, now = Date.now()): IntelligenceDataset {
  return {
    period,
    now,
    leads: [],
    quotes: [],
    jobs: [],
    laborByJob: {},
    invoices: [],
    payments: [],
    partsUsage: [],
    unavailableModules: [],
  };
}

export function inPeriod(at: number | undefined, period: Period): boolean {
  if (at === undefined || !Number.isFinite(at)) return false;
  return at >= period.start && at < period.end;
}

function ref(module: string, entity: string, id: string): SourceRef {
  return { module, entity, id };
}

function has(ds: IntelligenceDataset, moduleId: string): boolean {
  return !ds.unavailableModules.includes(moduleId);
}

function completenessFor(
  ds: IntelligenceDataset,
  modules: string[],
): DataCompleteness {
  const missing = modules.filter((m) => !has(ds, m));
  if (missing.length === modules.length) return "unavailable";
  return missing.length > 0 ? "partial" : "complete";
}

function derived(
  statement: string,
  sources: SourceRef[],
  value?: number,
  unit?: MetricComputation["unit"],
): Evidence {
  const e: Evidence = { kind: "system_derived", statement, sources };
  if (value !== undefined) e.value = value;
  if (unit !== undefined) e.unit = unit;
  return e;
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  // Ratios are rounded to 4 dp so a snapshot is byte-stable across runs.
  return Math.round((numerator / denominator) * 10_000) / 10_000;
}

// ---- Money helpers over source records ---------------------------------

/** Non-void invoices that were issued within the period. */
export function issuedInvoices(ds: IntelligenceDataset): Invoice[] {
  return ds.invoices.filter(
    (i) => i.status !== "void" && i.status !== "draft" && inPeriod(i.issuedAt, ds.period),
  );
}

export function invoicedRevenueCents(ds: IntelligenceDataset): number {
  return issuedInvoices(ds).reduce((sum, i) => sum + i.total, 0);
}

export function collectedRevenueCents(ds: IntelligenceDataset): number {
  return ds.payments
    .filter((p) => inPeriod(p.paidAt, ds.period))
    .reduce((sum, p) => sum + p.amount, 0);
}

export function outstandingBalanceCents(ds: IntelligenceDataset): number {
  return issuedInvoices(ds).reduce((sum, i) => sum + i.balance, 0);
}

export function partsCostCents(ds: IntelligenceDataset): number {
  return ds.partsUsage
    .filter((u) => inPeriod(u.usedAt, ds.period))
    .reduce((sum, u) => sum + u.totalCost, 0);
}

export function laborRevenueCents(ds: IntelligenceDataset): number {
  let total = 0;
  for (const entries of Object.values(ds.laborByJob)) {
    for (const e of entries) {
      if (!inPeriod(e.createdAt, ds.period)) continue;
      total += laborTotalCents(e.hours, e.rateCents);
    }
  }
  return total;
}

// ---- Metric catalogue ---------------------------------------------------

export interface MetricCalculator {
  definition: MetricDefinition;
  compute(ds: IntelligenceDataset): MetricComputation;
}

function metric(
  definition: MetricDefinition,
  compute: (ds: IntelligenceDataset) => Omit<MetricComputation, "metricId" | "unit" | "calculationVersion">,
): MetricCalculator {
  return {
    definition,
    compute: (ds) => ({
      metricId: definition.id,
      unit: definition.unit,
      calculationVersion: definition.version,
      ...compute(ds),
    }),
  };
}

const leadsIn = (ds: IntelligenceDataset) =>
  ds.leads.filter((l) => inPeriod(l.createdAt, ds.period));
const quotesIn = (ds: IntelligenceDataset) =>
  ds.quotes.filter((q) => inPeriod(q.createdAt, ds.period));
const jobsIn = (ds: IntelligenceDataset) =>
  ds.jobs.filter((j) => inPeriod(j.createdAt, ds.period));

const QUALIFIED_LEAD_STATUSES = [
  "qualified",
  "quote_prepared",
  "quote_sent",
  "considering",
  "scheduled",
  "won",
];

export function isQualifiedLead(lead: Lead): boolean {
  return QUALIFIED_LEAD_STATUSES.includes(lead.status);
}

export const METRIC_CALCULATORS: MetricCalculator[] = [
  metric(
    {
      id: "lead_count",
      name: "Leads",
      description: "Leads created within the period.",
      unit: "count",
      calculation: "count(leads where createdAt in period)",
      sourceModules: ["marketing"],
      version: 1,
    },
    (ds) => {
      const leads = leadsIn(ds);
      return {
        value: leads.length,
        completeness: completenessFor(ds, ["marketing"]),
        evidence: [
          derived(
            `${leads.length} lead(s) created in the period.`,
            leads.slice(0, 25).map((l) => ref("marketing", "lead", l.id)),
            leads.length,
            "count",
          ),
        ],
      };
    },
  ),

  metric(
    {
      id: "qualified_lead_count",
      name: "Qualified leads",
      description: "Leads that reached a qualified-or-later lifecycle state.",
      unit: "count",
      calculation: `count(leads in period where status in [${QUALIFIED_LEAD_STATUSES.join(", ")}])`,
      sourceModules: ["marketing"],
      version: 1,
    },
    (ds) => {
      const qualified = leadsIn(ds).filter(isQualifiedLead);
      return {
        value: qualified.length,
        completeness: completenessFor(ds, ["marketing"]),
        evidence: [
          derived(
            `${qualified.length} lead(s) reached a qualified state.`,
            qualified.slice(0, 25).map((l) => ref("marketing", "lead", l.id)),
            qualified.length,
            "count",
          ),
        ],
      };
    },
  ),

  metric(
    {
      id: "lead_conversion_rate",
      name: "Lead conversion rate",
      description: "Share of period leads that reached status 'won'.",
      unit: "ratio",
      calculation: "count(leads won) / count(leads in period)",
      sourceModules: ["marketing"],
      version: 1,
    },
    (ds) => {
      const leads = leadsIn(ds);
      const won = leads.filter((l) => l.status === "won");
      return {
        value: ratio(won.length, leads.length),
        completeness:
          leads.length === 0
            ? "unavailable"
            : completenessFor(ds, ["marketing"]),
        evidence: [
          derived(
            `${won.length} of ${leads.length} lead(s) were won.`,
            won.slice(0, 25).map((l) => ref("marketing", "lead", l.id)),
            won.length,
            "count",
          ),
        ],
        ...(leads.length === 0
          ? { limitation: "No leads were created in this period." }
          : {}),
      };
    },
  ),

  metric(
    {
      id: "average_response_time",
      name: "Average first-response time",
      description:
        "Mean time from lead creation to the first recorded Skild response.",
      unit: "ms",
      calculation: "mean(firstResponseAt - createdAt) over leads with a response",
      sourceModules: ["marketing"],
      version: 1,
    },
    (ds) => {
      const leads = leadsIn(ds);
      const responded = leads.filter(
        (l) => l.firstResponseAt !== undefined && l.firstResponseAt >= l.createdAt,
      );
      const total = responded.reduce(
        (sum, l) => sum + ((l.firstResponseAt as number) - l.createdAt),
        0,
      );
      const value = responded.length === 0 ? 0 : Math.round(total / responded.length);
      const complete: DataCompleteness =
        responded.length === 0
          ? "unavailable"
          : responded.length === leads.length
            ? completenessFor(ds, ["marketing"])
            : "partial";
      return {
        value,
        completeness: complete,
        evidence: [
          derived(
            `${responded.length} of ${leads.length} lead(s) have a recorded first response.`,
            responded.slice(0, 25).map((l) => ref("marketing", "lead", l.id)),
            responded.length,
            "count",
          ),
        ],
        ...(responded.length < leads.length
          ? {
              limitation: `${leads.length - responded.length} lead(s) have no recorded first response and are excluded.`,
            }
          : {}),
      };
    },
  ),

  metric(
    {
      id: "quote_count",
      name: "Quotes",
      description: "Quotes created within the period.",
      unit: "count",
      calculation: "count(quotes where createdAt in period)",
      sourceModules: ["quotes"],
      version: 1,
    },
    (ds) => {
      const quotes = quotesIn(ds);
      return {
        value: quotes.length,
        completeness: completenessFor(ds, ["quotes"]),
        evidence: [
          derived(
            `${quotes.length} quote(s) created in the period.`,
            quotes.slice(0, 25).map((q) => ref("quotes", "quote", q.id)),
            quotes.length,
            "count",
          ),
        ],
      };
    },
  ),

  metric(
    {
      id: "quote_approved_count",
      name: "Approved quotes",
      description: "Period quotes currently in status 'approved'.",
      unit: "count",
      calculation: "count(quotes in period where status = approved)",
      sourceModules: ["quotes"],
      version: 1,
    },
    (ds) => {
      const approved = quotesIn(ds).filter((q) => q.status === "approved");
      return {
        value: approved.length,
        completeness: completenessFor(ds, ["quotes"]),
        evidence: [
          derived(
            `${approved.length} quote(s) approved.`,
            approved.slice(0, 25).map((q) => ref("quotes", "quote", q.id)),
            approved.length,
            "count",
          ),
        ],
      };
    },
  ),

  metric(
    {
      id: "quote_conversion_rate",
      name: "Quote conversion rate",
      description: "Approved quotes as a share of quotes created.",
      unit: "ratio",
      calculation: "count(approved quotes) / count(quotes in period)",
      sourceModules: ["quotes"],
      version: 1,
    },
    (ds) => {
      const quotes = quotesIn(ds);
      const approved = quotes.filter((q) => q.status === "approved");
      return {
        value: ratio(approved.length, quotes.length),
        completeness:
          quotes.length === 0 ? "unavailable" : completenessFor(ds, ["quotes"]),
        evidence: [
          derived(
            `${approved.length} of ${quotes.length} quote(s) were approved.`,
            approved.slice(0, 25).map((q) => ref("quotes", "quote", q.id)),
            approved.length,
            "count",
          ),
        ],
        ...(quotes.length === 0
          ? { limitation: "No quotes were created in this period." }
          : {}),
      };
    },
  ),

  metric(
    {
      id: "quote_value_total",
      name: "Quoted value",
      description: "Sum of quote totals created in the period, in cents.",
      unit: "cents",
      calculation: "sum(quote.totalCents) over quotes in period",
      sourceModules: ["quotes"],
      version: 1,
    },
    (ds) => {
      const quotes = quotesIn(ds);
      const total = quotes.reduce((s, q) => s + q.totalCents, 0);
      return {
        value: total,
        completeness: completenessFor(ds, ["quotes"]),
        evidence: [
          derived(
            `Sum of ${quotes.length} quote total(s).`,
            quotes.slice(0, 25).map((q) => ref("quotes", "quote", q.id)),
            total,
            "cents",
          ),
        ],
      };
    },
  ),

  metric(
    {
      id: "average_quote_value",
      name: "Average quote value",
      description: "Mean quote total in the period, in cents.",
      unit: "cents",
      calculation: "sum(quote.totalCents) / count(quotes in period)",
      sourceModules: ["quotes"],
      version: 1,
    },
    (ds) => {
      const quotes = quotesIn(ds);
      const total = quotes.reduce((s, q) => s + q.totalCents, 0);
      const value = quotes.length === 0 ? 0 : Math.round(total / quotes.length);
      return {
        value,
        completeness:
          quotes.length === 0 ? "unavailable" : completenessFor(ds, ["quotes"]),
        evidence: [
          derived(
            `Mean of ${quotes.length} quote total(s).`,
            quotes.slice(0, 25).map((q) => ref("quotes", "quote", q.id)),
            value,
            "cents",
          ),
        ],
        ...(quotes.length === 0
          ? { limitation: "No quotes were created in this period." }
          : {}),
      };
    },
  ),

  metric(
    {
      id: "job_scheduled_count",
      name: "Scheduled jobs",
      description: "Jobs with a scheduled start inside the period.",
      unit: "count",
      calculation: "count(jobs where scheduledStart in period and status != cancelled)",
      sourceModules: ["jobs"],
      version: 1,
    },
    (ds) => {
      const scheduled = ds.jobs.filter(
        (j) => inPeriod(j.scheduledStart, ds.period) && j.status !== "cancelled",
      );
      return {
        value: scheduled.length,
        completeness: completenessFor(ds, ["jobs"]),
        evidence: [
          derived(
            `${scheduled.length} job(s) scheduled in the period.`,
            scheduled.slice(0, 25).map((j) => ref("jobs", "job", j.id)),
            scheduled.length,
            "count",
          ),
        ],
      };
    },
  ),

  metric(
    {
      id: "job_completed_count",
      name: "Completed jobs",
      description: "Jobs created in the period currently in status 'completed'.",
      unit: "count",
      calculation: "count(jobs in period where status = completed)",
      sourceModules: ["jobs"],
      version: 1,
    },
    (ds) => {
      const completed = jobsIn(ds).filter((j) => j.status === "completed");
      return {
        value: completed.length,
        completeness: completenessFor(ds, ["jobs"]),
        evidence: [
          derived(
            `${completed.length} job(s) completed.`,
            completed.slice(0, 25).map((j) => ref("jobs", "job", j.id)),
            completed.length,
            "count",
          ),
        ],
      };
    },
  ),

  metric(
    {
      id: "job_cancelled_count",
      name: "Cancelled jobs",
      description: "Jobs created in the period currently in status 'cancelled'.",
      unit: "count",
      calculation: "count(jobs in period where status = cancelled)",
      sourceModules: ["jobs"],
      version: 1,
    },
    (ds) => {
      const cancelled = jobsIn(ds).filter((j) => j.status === "cancelled");
      return {
        value: cancelled.length,
        completeness: completenessFor(ds, ["jobs"]),
        evidence: [
          derived(
            `${cancelled.length} job(s) cancelled.`,
            cancelled.slice(0, 25).map((j) => ref("jobs", "job", j.id)),
            cancelled.length,
            "count",
          ),
        ],
      };
    },
  ),

  metric(
    {
      id: "invoiced_revenue",
      name: "Invoiced revenue",
      description: "Total of invoices issued in the period, in cents.",
      unit: "cents",
      calculation: "sum(invoice.total) over issued, non-void invoices in period",
      sourceModules: ["finance"],
      version: 1,
    },
    (ds) => {
      const invoices = issuedInvoices(ds);
      const total = invoicedRevenueCents(ds);
      return {
        value: total,
        completeness: completenessFor(ds, ["finance"]),
        evidence: [
          derived(
            `Sum of ${invoices.length} issued invoice total(s).`,
            invoices.slice(0, 25).map((i) => ref("finance", "invoice", i.id)),
            total,
            "cents",
          ),
        ],
      };
    },
  ),

  metric(
    {
      id: "collected_revenue",
      name: "Collected revenue",
      description: "Payments recorded in the period, in cents.",
      unit: "cents",
      calculation: "sum(payment.amount) over payments with paidAt in period",
      sourceModules: ["finance"],
      version: 1,
    },
    (ds) => {
      const payments = ds.payments.filter((p) => inPeriod(p.paidAt, ds.period));
      const total = collectedRevenueCents(ds);
      return {
        value: total,
        completeness: completenessFor(ds, ["finance"]),
        evidence: [
          derived(
            `Sum of ${payments.length} recorded payment(s).`,
            payments.slice(0, 25).map((p) => ref("finance", "payment", p.id)),
            total,
            "cents",
          ),
        ],
      };
    },
  ),

  metric(
    {
      id: "outstanding_balance",
      name: "Outstanding balance",
      description: "Unpaid balance across invoices issued in the period.",
      unit: "cents",
      calculation: "sum(invoice.balance) over issued, non-void invoices in period",
      sourceModules: ["finance"],
      version: 1,
    },
    (ds) => {
      const invoices = issuedInvoices(ds).filter((i) => i.balance > 0);
      const total = outstandingBalanceCents(ds);
      return {
        value: total,
        completeness: completenessFor(ds, ["finance"]),
        evidence: [
          derived(
            `${invoices.length} invoice(s) carry a balance.`,
            invoices.slice(0, 25).map((i) => ref("finance", "invoice", i.id)),
            total,
            "cents",
          ),
        ],
      };
    },
  ),

  metric(
    {
      id: "parts_cost",
      name: "Parts cost",
      description: "Recorded parts usage cost in the period, in cents.",
      unit: "cents",
      calculation: "sum(partUsage.totalCost) over usage with usedAt in period",
      sourceModules: ["parts"],
      version: 1,
    },
    (ds) => {
      const usage = ds.partsUsage.filter((u) => inPeriod(u.usedAt, ds.period));
      const total = partsCostCents(ds);
      return {
        value: total,
        completeness: completenessFor(ds, ["parts"]),
        evidence: [
          derived(
            `Sum of ${usage.length} parts usage record(s).`,
            usage.slice(0, 25).map((u) => ref("parts", "usage", u.id)),
            total,
            "cents",
          ),
        ],
      };
    },
  ),

  metric(
    {
      id: "labor_revenue",
      name: "Labor revenue",
      description: "Billable labor value logged in the period, in cents.",
      unit: "cents",
      calculation: "sum(round(labor.hours * labor.rateCents)) over entries in period",
      sourceModules: ["jobs"],
      version: 1,
    },
    (ds) => {
      const total = laborRevenueCents(ds);
      const entries = Object.entries(ds.laborByJob).flatMap(([jobId, list]) =>
        list.filter((e) => inPeriod(e.createdAt, ds.period)).map(() => jobId),
      );
      return {
        value: total,
        completeness: completenessFor(ds, ["jobs"]),
        evidence: [
          derived(
            `${entries.length} labor entr(y/ies) logged.`,
            Array.from(new Set(entries))
              .slice(0, 25)
              .map((jobId) => ref("jobs", "job", jobId)),
            total,
            "cents",
          ),
        ],
      };
    },
  ),

  metric(
    {
      id: "gross_margin",
      name: "Gross margin",
      description:
        "Invoiced revenue minus recorded parts cost minus known labor cost.",
      unit: "cents",
      calculation: "invoiced_revenue - parts_cost - known labor cost (0 when no cost basis exists)",
      sourceModules: ["finance", "parts", "jobs"],
      version: 1,
    },
    (ds) => {
      const report = calculateProfitability(ds);
      return {
        value: report.grossMarginCents,
        completeness: report.completeness,
        evidence: [
          derived(
            `Revenue ${report.revenueCents}c − parts ${report.partsCostCents}c − labor cost ${report.laborCostCents}c.`,
            [],
            report.grossMarginCents,
            "cents",
          ),
        ],
        ...(report.limitations.length > 0
          ? { limitation: report.limitations.join(" ") }
          : {}),
      };
    },
  ),

  metric(
    {
      id: "repeat_customer_rate",
      name: "Repeat customer rate",
      description:
        "Share of customers with completed work in the period who also had earlier completed work.",
      unit: "ratio",
      calculation:
        "count(customers with a completed job in period AND a completed job before it) / count(customers with a completed job in period)",
      sourceModules: ["jobs"],
      version: 1,
    },
    (ds) => {
      const completedInPeriod = jobsIn(ds).filter((j) => j.status === "completed");
      const customers = new Set(completedInPeriod.map((j) => j.customerId));
      const earlier = ds.jobs.filter(
        (j) => j.status === "completed" && j.createdAt < ds.period.start,
      );
      const earlierCustomers = new Set(earlier.map((j) => j.customerId));
      const repeat = Array.from(customers).filter((c) => earlierCustomers.has(c));
      return {
        value: ratio(repeat.length, customers.size),
        completeness:
          customers.size === 0 ? "unavailable" : completenessFor(ds, ["jobs"]),
        evidence: [
          derived(
            `${repeat.length} of ${customers.size} customer(s) with completed work had earlier completed work.`,
            repeat.slice(0, 25).map((id) => ref("crm", "customer", id)),
            repeat.length,
            "count",
          ),
        ],
        ...(customers.size === 0
          ? { limitation: "No completed jobs in this period." }
          : {}),
      };
    },
  ),
];

export const METRIC_DEFINITIONS: MetricDefinition[] = METRIC_CALCULATORS.map(
  (c) => c.definition,
);

export function findMetricCalculator(id: string): MetricCalculator | undefined {
  return METRIC_CALCULATORS.find((c) => c.definition.id === id);
}

export function calculateMetrics(
  ds: IntelligenceDataset,
  metricIds?: string[],
): MetricComputation[] {
  const wanted = metricIds?.length
    ? METRIC_CALCULATORS.filter((c) => metricIds.includes(c.definition.id))
    : METRIC_CALCULATORS;
  return wanted.map((c) => c.compute(ds));
}

// ---- Funnel -------------------------------------------------------------

const STAGE_LABELS: Record<FunnelStageId, string> = {
  lead: "Lead",
  contacted: "Contacted",
  responded: "Responded",
  qualified: "Qualified",
  quote: "Quote",
  quote_sent: "Quote sent",
  scheduled: "Scheduled",
  job: "Job",
  completed: "Completed",
  revenue: "Revenue",
};

const REACHED_CONTACTED = [
  "contacted",
  "awaiting_customer",
  "qualifying",
  "qualified",
  "quote_prepared",
  "quote_sent",
  "considering",
  "scheduled",
  "won",
  "follow_up",
];

export function calculateFunnel(ds: IntelligenceDataset): FunnelReport {
  const leads = leadsIn(ds);
  const quotes = quotesIn(ds);
  const jobs = jobsIn(ds);
  const limitations: string[] = [];

  const contacted = leads.filter((l) => REACHED_CONTACTED.includes(l.status));
  const responded = leads.filter((l) => l.firstResponseAt !== undefined);
  const qualified = leads.filter(isQualifiedLead);
  const sentQuotes = quotes.filter((q) =>
    ["sent", "approved", "declined", "expired"].includes(q.status),
  );
  const scheduledJobs = jobs.filter((j) =>
    ["scheduled", "in_progress", "paused", "completed"].includes(j.status),
  );
  const completedJobs = jobs.filter((j) => j.status === "completed");
  const revenueInvoices = issuedInvoices(ds);

  if (!has(ds, "marketing")) limitations.push("Marketing repository unavailable — lead stages are empty.");
  if (!has(ds, "quotes")) limitations.push("Quotes repository unavailable — quote stages are empty.");
  if (!has(ds, "jobs")) limitations.push("Jobs repository unavailable — job stages are empty.");
  if (!has(ds, "finance")) limitations.push("Finance repository unavailable — revenue is unknown.");

  const raw: Array<{
    id: FunnelStageId;
    sources: SourceRef[];
    count: number;
    completeness: DataCompleteness;
  }> = [
    { id: "lead", sources: leads.map((l) => ref("marketing", "lead", l.id)), count: leads.length, completeness: completenessFor(ds, ["marketing"]) },
    { id: "contacted", sources: contacted.map((l) => ref("marketing", "lead", l.id)), count: contacted.length, completeness: completenessFor(ds, ["marketing"]) },
    { id: "responded", sources: responded.map((l) => ref("marketing", "lead", l.id)), count: responded.length, completeness: completenessFor(ds, ["marketing"]) },
    { id: "qualified", sources: qualified.map((l) => ref("marketing", "lead", l.id)), count: qualified.length, completeness: completenessFor(ds, ["marketing"]) },
    { id: "quote", sources: quotes.map((q) => ref("quotes", "quote", q.id)), count: quotes.length, completeness: completenessFor(ds, ["quotes"]) },
    { id: "quote_sent", sources: sentQuotes.map((q) => ref("quotes", "quote", q.id)), count: sentQuotes.length, completeness: completenessFor(ds, ["quotes"]) },
    { id: "scheduled", sources: scheduledJobs.map((j) => ref("jobs", "job", j.id)), count: scheduledJobs.length, completeness: completenessFor(ds, ["jobs"]) },
    { id: "job", sources: jobs.map((j) => ref("jobs", "job", j.id)), count: jobs.length, completeness: completenessFor(ds, ["jobs"]) },
    { id: "completed", sources: completedJobs.map((j) => ref("jobs", "job", j.id)), count: completedJobs.length, completeness: completenessFor(ds, ["jobs"]) },
    { id: "revenue", sources: revenueInvoices.map((i) => ref("finance", "invoice", i.id)), count: revenueInvoices.length, completeness: completenessFor(ds, ["finance"]) },
  ];

  const stages: FunnelStage[] = raw.map((stage, index) => {
    const prev = index === 0 ? undefined : raw[index - 1];
    const dropped = prev ? Math.max(0, prev.count - stage.count) : 0;
    return {
      id: stage.id,
      label: STAGE_LABELS[stage.id],
      count: stage.count,
      // Cap the id list so a snapshot stays bounded; the count is authoritative.
      sources: stage.sources.slice(0, 100),
      droppedFromPrevious: dropped,
      conversionFromPrevious:
        prev === undefined ? null : prev.count === 0 ? null : ratio(stage.count, prev.count),
      completeness: stage.completeness,
    };
  });

  let biggest: FunnelStage | undefined;
  for (const s of stages) {
    if (s.droppedFromPrevious > 0 && (!biggest || s.droppedFromPrevious > biggest.droppedFromPrevious)) {
      biggest = s;
    }
  }

  const completeness: DataCompleteness = limitations.length === 0
    ? "complete"
    : limitations.length >= 4
      ? "unavailable"
      : "partial";

  return {
    period: ds.period,
    stages,
    ...(biggest ? { biggestDropStageId: biggest.id } : {}),
    revenueCents: invoicedRevenueCents(ds),
    completeness,
    limitations,
  };
}

// ---- Profitability ------------------------------------------------------

export function calculateProfitability(ds: IntelligenceDataset): ProfitabilityReport {
  const limitations: string[] = [];
  const revenue = invoicedRevenueCents(ds);
  const collected = collectedRevenueCents(ds);
  const outstanding = outstandingBalanceCents(ds);
  const parts = partsCostCents(ds);
  const labor = laborRevenueCents(ds);

  const invoices = issuedInvoices(ds);
  const unlinkedInvoices = invoices.filter((i) => !i.jobId);
  const completedJobs = jobsIn(ds).filter((j) => j.status === "completed");
  const invoicedJobIds = new Set(
    ds.invoices.filter((i) => i.jobId && i.status !== "void").map((i) => i.jobId as string),
  );
  const uninvoicedJobs = completedJobs.filter((j) => !invoicedJobIds.has(j.id));

  // Skild OS records labor at a BILLING rate. There is no labor cost rate in
  // the system, so labor cost stays 0 and is declared unknown rather than
  // estimated. This is the honest boundary the audit requires.
  const laborCostKnown = false;
  const laborCost = 0;
  limitations.push(
    "Labor cost is not recorded anywhere in Skild OS (only a billing rate), so gross margin does not subtract labor cost.",
  );
  if (unlinkedInvoices.length > 0) {
    limitations.push(
      `${unlinkedInvoices.length} issued invoice(s) have no job link; their revenue cannot be attributed to work.`,
    );
  }
  if (uninvoicedJobs.length > 0) {
    limitations.push(
      `${uninvoicedJobs.length} completed job(s) have no invoice; no revenue is assumed for them.`,
    );
  }
  if (!has(ds, "finance")) limitations.push("Finance repository unavailable — revenue is unknown.");
  if (!has(ds, "parts")) limitations.push("Parts repository unavailable — parts cost is unknown.");

  const anySource = has(ds, "finance") || has(ds, "parts") || has(ds, "jobs");
  const completeness: DataCompleteness = !anySource
    ? "unavailable"
    : "partial"; // labor cost is always unknown → never "complete" today

  return {
    period: ds.period,
    revenueCents: revenue,
    collectedCents: collected,
    outstandingCents: outstanding,
    partsCostCents: parts,
    laborRevenueCents: labor,
    laborCostCents: laborCost,
    laborCostKnown,
    grossMarginCents: revenue - parts - laborCost,
    completeness,
    limitations,
    unlinkedInvoiceCount: unlinkedInvoices.length,
    uninvoicedJobCount: uninvoicedJobs.length,
  };
}

// ---- Service performance -----------------------------------------------

/**
 * Service labels come from Lead.serviceRequested and Quote.title exactly as
 * recorded. They are trimmed for grouping but NEVER normalised into a
 * canonical taxonomy — Skild OS has no service catalogue yet, and inventing
 * one here would manufacture false certainty.
 */
export function calculateServicePerformance(
  ds: IntelligenceDataset,
): ServicePerformanceRow[] {
  const rows = new Map<string, ServicePerformanceRow>();
  const row = (service: string): ServicePerformanceRow => {
    const key = service.trim() || "unknown";
    let existing = rows.get(key);
    if (!existing) {
      existing = {
        service: key,
        leadCount: 0,
        quoteCount: 0,
        jobCount: 0,
        completedJobCount: 0,
        quotedValueCents: 0,
        revenueCents: 0,
        partsCostCents: 0,
        grossMarginCents: 0,
        conversionRate: null,
        completeness: "partial",
      };
      rows.set(key, existing);
    }
    return existing;
  };

  for (const lead of leadsIn(ds)) {
    row(lead.serviceRequested ?? "unknown").leadCount += 1;
  }

  const quoteService = new Map<string, string>();
  for (const quote of quotesIn(ds)) {
    const service = quote.title.trim() || "unknown";
    quoteService.set(quote.id, service);
    const r = row(service);
    r.quoteCount += 1;
    r.quotedValueCents += quote.totalCents;
  }

  const jobService = new Map<string, string>();
  for (const job of jobsIn(ds)) {
    const service =
      (job.quoteId ? quoteService.get(job.quoteId) : undefined) ??
      job.title.trim() ??
      "unknown";
    jobService.set(job.id, service);
    const r = row(service);
    r.jobCount += 1;
    if (job.status === "completed") r.completedJobCount += 1;
  }

  for (const invoice of issuedInvoices(ds)) {
    const service = invoice.jobId ? jobService.get(invoice.jobId) : undefined;
    if (!service) continue; // unattributable revenue stays out of service rows
    row(service).revenueCents += invoice.total;
  }

  for (const usage of ds.partsUsage) {
    if (!inPeriod(usage.usedAt, ds.period)) continue;
    const service = usage.jobId ? jobService.get(usage.jobId) : undefined;
    if (!service) continue;
    row(service).partsCostCents += usage.totalCost;
  }

  return Array.from(rows.values())
    .map((r) => ({
      ...r,
      grossMarginCents: r.revenueCents - r.partsCostCents,
      conversionRate: r.leadCount > 0 ? ratio(r.completedJobCount, r.leadCount) : null,
      completeness:
        r.leadCount > 0 && r.quoteCount > 0 && r.revenueCents > 0
          ? ("complete" as DataCompleteness)
          : ("partial" as DataCompleteness),
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents || a.service.localeCompare(b.service));
}

// ---- Source performance -------------------------------------------------

export function calculateSourcePerformance(
  ds: IntelligenceDataset,
): SourcePerformanceRow[] {
  const rows = new Map<string, SourcePerformanceRow>();
  const invoiceById = new Map(ds.invoices.map((i) => [i.id, i]));
  const jobById = new Map(ds.jobs.map((j) => [j.id, j]));
  const invoicesByJob = new Map<string, typeof ds.invoices>();
  for (const inv of ds.invoices) {
    if (!inv.jobId || inv.status === "void" || inv.status === "draft") continue;
    const list = invoicesByJob.get(inv.jobId) ?? [];
    list.push(inv);
    invoicesByJob.set(inv.jobId, list);
  }

  for (const lead of leadsIn(ds)) {
    // Attribution is taken verbatim. A lead with no recorded source is
    // "unknown" — never reassigned to a plausible channel.
    const source = lead.attribution?.firstTouch?.source ?? "unknown";
    let r = rows.get(source);
    if (!r) {
      r = {
        source,
        leadCount: 0,
        qualifiedCount: 0,
        quoteCount: 0,
        jobCount: 0,
        revenueCents: 0,
        conversionRate: null,
        completeness: source === "unknown" ? "partial" : "complete",
      };
      rows.set(source, r);
    }
    r.leadCount += 1;
    if (isQualifiedLead(lead)) r.qualifiedCount += 1;
    if (lead.quoteId) r.quoteCount += 1;
    if (lead.jobId) {
      r.jobCount += 1;
      for (const inv of invoicesByJob.get(lead.jobId) ?? []) {
        r.revenueCents += inv.total;
      }
    } else if (lead.invoiceId) {
      const inv = invoiceById.get(lead.invoiceId);
      if (inv && inv.status !== "void" && inv.status !== "draft") {
        r.revenueCents += inv.total;
      }
    }
    if (lead.jobId && !jobById.has(lead.jobId)) {
      r.completeness = "partial";
    }
  }

  return Array.from(rows.values())
    .map((r) => ({
      ...r,
      conversionRate: r.leadCount > 0 ? ratio(r.jobCount, r.leadCount) : null,
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents || b.leadCount - a.leadCount);
}

// ---- Expected vs actual -------------------------------------------------

export function calculateExpectedVsActual(
  ds: IntelligenceDataset,
): ExpectedVsActualRow[] {
  const quoteById = new Map(ds.quotes.map((q) => [q.id, q]));
  const invoicesByJob = new Map<string, Invoice[]>();
  for (const inv of ds.invoices) {
    if (!inv.jobId || inv.status === "void" || inv.status === "draft") continue;
    const list = invoicesByJob.get(inv.jobId) ?? [];
    list.push(inv);
    invoicesByJob.set(inv.jobId, list);
  }

  const rows: ExpectedVsActualRow[] = [];
  for (const job of jobsIn(ds)) {
    const missing: string[] = [];
    const quote = job.quoteId ? quoteById.get(job.quoteId) : undefined;
    if (!job.quoteId) missing.push("job has no quote link");
    else if (!quote) missing.push("linked quote not found");

    const invoices = invoicesByJob.get(job.id) ?? [];
    if (invoices.length === 0) missing.push("job has no issued invoice");

    const expectedRevenue = quote?.totalCents;
    const actualRevenue = invoices.length
      ? invoices.reduce((s, i) => s + i.total, 0)
      : undefined;

    const expectedLaborHours = quote
      ? quote.lineItems.reduce((s, li) => s + (li.laborHours ?? 0), 0)
      : undefined;
    const actualLaborHours = (ds.laborByJob[job.id] ?? []).reduce(
      (s, e) => s + e.hours,
      0,
    );

    const expectedPartsCost = quote
      ? quote.lineItems
          .filter((li) => li.category === "part")
          .reduce((s, li) => s + li.totalCents, 0)
      : undefined;
    const actualPartsCost = ds.partsUsage
      .filter((u) => u.jobId === job.id)
      .reduce((s, u) => s + u.totalCost, 0);

    const row: ExpectedVsActualRow = {
      jobId: job.id,
      completeness: missing.length === 0 ? "complete" : "partial",
      missing,
    };
    if (job.quoteId) row.quoteId = job.quoteId;
    if (invoices[0]) row.invoiceId = invoices[0].id;
    if (expectedRevenue !== undefined) row.expectedRevenueCents = expectedRevenue;
    if (actualRevenue !== undefined) row.actualRevenueCents = actualRevenue;
    if (expectedRevenue !== undefined && actualRevenue !== undefined) {
      row.varianceCents = actualRevenue - expectedRevenue;
    }
    if (expectedLaborHours !== undefined) row.expectedLaborHours = expectedLaborHours;
    row.actualLaborHours = actualLaborHours;
    if (expectedPartsCost !== undefined) row.expectedPartsCostCents = expectedPartsCost;
    row.actualPartsCostCents = actualPartsCost;
    rows.push(row);
  }
  return rows;
}

// ---- Attention ----------------------------------------------------------

export function calculateAttention(
  ds: IntelligenceDataset,
  opts: { staleLeadMs: number; quoteAgingMs: number },
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const days = (ms: number) => Math.floor(ms / DAY_MS);

  for (const lead of ds.leads) {
    if (lead.status === "won" || lead.status === "lost") continue;
    if (lead.awaitingParty !== "skild") continue;
    const age = ds.now - (lead.lastContactedAt ?? lead.createdAt);
    if (age < opts.staleLeadMs) continue;
    items.push({
      id: `stale_lead:${lead.id}`,
      kind: "stale_lead",
      title: lead.serviceRequested
        ? `Lead waiting: ${lead.serviceRequested}`
        : "Lead waiting on Skild",
      detail: `Status "${lead.status}", no Skild activity for ${days(age)} day(s).`,
      ageDays: days(age),
      source: ref("marketing", "lead", lead.id),
    });
  }

  for (const quote of ds.quotes) {
    if (quote.status !== "sent") continue;
    const age = ds.now - quote.updatedAt;
    if (age < opts.quoteAgingMs) continue;
    items.push({
      id: `stale_quote:${quote.id}`,
      kind: "stale_quote",
      title: `Quote awaiting decision: ${quote.title}`,
      detail: `Sent ${days(age)} day(s) ago with no approval or decline recorded.`,
      ageDays: days(age),
      amountCents: quote.totalCents,
      source: ref("quotes", "quote", quote.id),
    });
  }

  for (const invoice of ds.invoices) {
    if (invoice.status === "void" || invoice.status === "draft") continue;
    if (invoice.balance <= 0) continue;
    const age = ds.now - (invoice.issuedAt ?? invoice.createdAt);
    items.push({
      id: `outstanding_invoice:${invoice.id}`,
      kind: "outstanding_invoice",
      title: `Unpaid invoice ${invoice.number}`,
      detail: `Balance outstanding for ${days(age)} day(s).`,
      ageDays: days(age),
      amountCents: invoice.balance,
      source: ref("finance", "invoice", invoice.id),
    });
  }

  const invoicedJobIds = new Set(
    ds.invoices.filter((i) => i.jobId && i.status !== "void").map((i) => i.jobId as string),
  );
  for (const job of ds.jobs) {
    if (job.status !== "completed") continue;
    if (invoicedJobIds.has(job.id)) continue;
    const age = ds.now - job.updatedAt;
    items.push({
      id: `uninvoiced_job:${job.id}`,
      kind: "uninvoiced_job",
      title: `Completed job not invoiced: ${job.title}`,
      detail: `Completed ${days(age)} day(s) ago with no invoice recorded.`,
      ageDays: days(age),
      source: ref("jobs", "job", job.id),
    });
  }

  return items.sort((a, b) => b.ageDays - a.ageDays);
}
