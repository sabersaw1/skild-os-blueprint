// Business Intelligence domain types (Phase 14).
//
// RULES
//  * BI is a READ/DERIVED layer. It never duplicates a Customer, Vehicle,
//    Quote, Job, Invoice, Payment, Part or Lead record. Analytical records
//    reference source entities by opaque id through `SourceRef`.
//  * Money is INTEGER CENTS everywhere (see @/core/money). No floats.
//  * Every analytical claim (observation, opportunity, recommendation,
//    metric snapshot) carries evidence with an explicit `EvidenceKind`, so
//    an assumption can never silently become a verified business fact.
//  * Recommendations are PROPOSALS. Nothing in this module executes a
//    consequential action; execution belongs to the Phase 13 automation
//    control boundary.
//  * All timestamps are epoch milliseconds (UTC).

// ---- Evidence -----------------------------------------------------------

export type EvidenceKind =
  /** Read directly from an authoritative repository record. */
  | "verified_data"
  /** Supplied by a customer (lead text, inbound message). Unverified. */
  | "customer_provided"
  /** Computed by Skild OS from verified records (counts, sums, ages). */
  | "system_derived"
  /** Produced by a language model. Never a business fact on its own. */
  | "ai_suggestion"
  /** A stated modelling assumption. Explicitly NOT a fact. */
  | "assumption";

export const EVIDENCE_KINDS: EvidenceKind[] = [
  "verified_data",
  "customer_provided",
  "system_derived",
  "ai_suggestion",
  "assumption",
];

/** Kinds that may be presented as business fact. */
export const FACTUAL_EVIDENCE_KINDS: EvidenceKind[] = [
  "verified_data",
  "system_derived",
];

/** Opaque pointer at a record owned by another module. */
export interface SourceRef {
  /** Owning module id, e.g. "jobs", "finance", "marketing". */
  module: string;
  /** Entity name, singular: "job", "invoice", "lead". */
  entity: string;
  /** Opaque record id from that module's repository. */
  id: string;
}

export interface Evidence {
  kind: EvidenceKind;
  /** Plain-language statement, rendered verbatim in the UI. */
  statement: string;
  /** Records the statement was derived from. May be empty for assumptions. */
  sources: SourceRef[];
  /** Optional structured value behind the statement. */
  value?: number;
  unit?: MetricUnit;
}

// ---- Periods and completeness ------------------------------------------

export interface Period {
  /** Inclusive epoch-ms start. */
  start: number;
  /** Exclusive epoch-ms end. */
  end: number;
}

/**
 * How trustworthy a calculated figure is given the underlying records.
 *   complete    — every input the calculation needs was present
 *   partial     — computed, but some inputs were missing or unlinked
 *   unavailable — the source module is not registered / no data at all
 */
export type DataCompleteness = "complete" | "partial" | "unavailable";

export type MetricUnit =
  | "count"
  | "cents"
  | "ratio"
  | "ms"
  | "hours"
  | "days";

// ---- Metric definitions -------------------------------------------------

export interface MetricDefinition {
  /** Stable, immutable id. Never renamed once shipped. */
  id: string;
  name: string;
  description: string;
  unit: MetricUnit;
  /** Human-readable definition of how the number is produced. */
  calculation: string;
  /** Modules whose records the calculation reads. */
  sourceModules: string[];
  /** Bumped whenever the calculation changes meaning. */
  version: number;
}

export interface MetricSnapshot {
  id: string;
  metricId: string;
  periodStart: number;
  periodEnd: number;
  /** Cents for money metrics, count for counts, 0..1 for ratios. */
  value: number;
  unit: MetricUnit;
  calculationVersion: number;
  completeness: DataCompleteness;
  /** Why the value is what it is, including any declared limitation. */
  evidence: Evidence[];
  generatedAt: number;
  generatedBy: string;
}

/** Result of running one metric calculation over a dataset. */
export interface MetricComputation {
  metricId: string;
  value: number;
  unit: MetricUnit;
  calculationVersion: number;
  completeness: DataCompleteness;
  evidence: Evidence[];
  /** Present when the figure is limited by missing/contradictory data. */
  limitation?: string;
}

// ---- Observations -------------------------------------------------------

export type ObservationType =
  | "lead_volume"
  | "lead_conversion"
  | "response_time"
  | "quote_conversion"
  | "quote_aging"
  | "follow_up_backlog"
  | "service_demand"
  | "cost_anomaly"
  | "revenue"
  | "scheduling"
  | "retention"
  | "data_quality";

export const OBSERVATION_TYPES: ObservationType[] = [
  "lead_volume",
  "lead_conversion",
  "response_time",
  "quote_conversion",
  "quote_aging",
  "follow_up_backlog",
  "service_demand",
  "cost_anomaly",
  "revenue",
  "scheduling",
  "retention",
  "data_quality",
];

export type ObservationSeverity = "info" | "low" | "medium" | "high";

export const OBSERVATION_SEVERITIES: ObservationSeverity[] = [
  "info",
  "low",
  "medium",
  "high",
];

export type ObservationStatus =
  | "open"
  | "acknowledged"
  | "dismissed"
  | "resolved";

export const OBSERVATION_STATUSES: ObservationStatus[] = [
  "open",
  "acknowledged",
  "dismissed",
  "resolved",
];

export interface Observation {
  id: string;
  type: ObservationType;
  severity: ObservationSeverity;
  title: string;
  description: string;
  evidence: Evidence[];
  /** 0..1. Deterministic rules state their own confidence explicitly. */
  confidence: number;
  status: ObservationStatus;
  /** Metric that triggered it, when any. */
  metricId?: string;
  periodStart?: number;
  periodEnd?: number;
  /**
   * Stable key identifying "this finding for this period", so re-running the
   * optimization engine updates rather than duplicates.
   */
  dedupeKey?: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface ObservationCreateInput {
  type: ObservationType;
  severity: ObservationSeverity;
  title: string;
  description: string;
  evidence: Evidence[];
  confidence: number;
  metricId?: string;
  periodStart?: number;
  periodEnd?: number;
  dedupeKey?: string;
}

export interface ObservationListQuery {
  status?: ObservationStatus;
  type?: ObservationType;
  severity?: ObservationSeverity;
  limit?: number;
}

// ---- Opportunities ------------------------------------------------------

export type OpportunityType =
  | "follow_up"
  | "lead_conversion"
  | "scheduling"
  | "repeat_service"
  | "supplier_cost"
  | "marketing"
  | "service_page"
  | "pricing_review";

export const OPPORTUNITY_TYPES: OpportunityType[] = [
  "follow_up",
  "lead_conversion",
  "scheduling",
  "repeat_service",
  "supplier_cost",
  "marketing",
  "service_page",
  "pricing_review",
];

export type OpportunityStatus =
  | "open"
  | "acknowledged"
  | "dismissed"
  | "resolved";

export interface IntelligenceOpportunity {
  id: string;
  type: OpportunityType;
  title: string;
  description: string;
  evidence: Evidence[];
  /** Integer cents. Present ONLY when calculable from verified records. */
  expectedImpactCents?: number;
  /** Why the impact figure is what it is, when present. */
  impactBasis?: string;
  confidence: number;
  status: OpportunityStatus;
  /** Opaque ids owned by other modules. */
  relatedIds: SourceRef[];
  dedupeKey?: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface OpportunityCreateInput {
  type: OpportunityType;
  title: string;
  description: string;
  evidence: Evidence[];
  expectedImpactCents?: number;
  impactBasis?: string;
  confidence: number;
  relatedIds?: SourceRef[];
  dedupeKey?: string;
}

export interface OpportunityListQuery {
  status?: OpportunityStatus;
  type?: OpportunityType;
  limit?: number;
}

// ---- Recommendations ----------------------------------------------------

export type RecommendationType =
  | "follow_up_leads"
  | "review_service_conversion"
  | "investigate_parts_cost"
  | "improve_response_time"
  | "create_content"
  | "chase_outstanding_invoices"
  | "review_quote_aging"
  | "contact_repeat_customers";

export const RECOMMENDATION_TYPES: RecommendationType[] = [
  "follow_up_leads",
  "review_service_conversion",
  "investigate_parts_cost",
  "improve_response_time",
  "create_content",
  "chase_outstanding_invoices",
  "review_quote_aging",
  "contact_repeat_customers",
];

/**
 * Every recommendation declares how it would have to be authorised IF a
 * human ever chose to act on it. Phase 14 executes nothing; this field
 * exists so future automation inherits the boundary rather than inventing
 * one.
 */
export type ApprovalRequirement =
  /** A human may act directly; nothing consequential happens automatically. */
  | "human_review"
  /** Would require explicit approval through the automation boundary. */
  | "approval_required"
  /** Must never be executed automatically under any policy. */
  | "blocked";

export type RecommendationStatus =
  | "proposed"
  | "accepted"
  | "dismissed"
  | "completed";

export const RECOMMENDATION_STATUSES: RecommendationStatus[] = [
  "proposed",
  "accepted",
  "dismissed",
  "completed",
];

export interface Recommendation {
  id: string;
  recommendationType: RecommendationType;
  title: string;
  /** Plain-language explanation of WHY, reconstructable from evidence. */
  reason: string;
  evidence: Evidence[];
  confidence: number;
  /** What a human could do. Never executed by this module. */
  proposedAction: string;
  /** Capabilities the eventual action would require. */
  requiredCapabilities: string[];
  approvalRequirement: ApprovalRequirement;
  status: RecommendationStatus;
  relatedIds: SourceRef[];
  dedupeKey?: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface RecommendationCreateInput {
  recommendationType: RecommendationType;
  title: string;
  reason: string;
  evidence: Evidence[];
  confidence: number;
  proposedAction: string;
  requiredCapabilities: string[];
  approvalRequirement: ApprovalRequirement;
  relatedIds?: SourceRef[];
  dedupeKey?: string;
}

export interface RecommendationListQuery {
  status?: RecommendationStatus;
  recommendationType?: RecommendationType;
  limit?: number;
}

// ---- Read models --------------------------------------------------------

export type FunnelStageId =
  | "lead"
  | "contacted"
  | "responded"
  | "qualified"
  | "quote"
  | "quote_sent"
  | "scheduled"
  | "job"
  | "completed"
  | "revenue";

export const FUNNEL_STAGE_IDS: FunnelStageId[] = [
  "lead",
  "contacted",
  "responded",
  "qualified",
  "quote",
  "quote_sent",
  "scheduled",
  "job",
  "completed",
  "revenue",
];

export interface FunnelStage {
  id: FunnelStageId;
  label: string;
  count: number;
  /** Ids of the underlying records, never copies of them. */
  sources: SourceRef[];
  /** Count lost between the previous stage and this one (never negative). */
  droppedFromPrevious: number;
  /** count / previous stage count, or null when previous is 0. */
  conversionFromPrevious: number | null;
  completeness: DataCompleteness;
}

export interface FunnelReport {
  period: Period;
  stages: FunnelStage[];
  /** Stage with the largest absolute drop, when one exists. */
  biggestDropStageId?: FunnelStageId;
  /** Revenue realised from the period's work, in integer cents. */
  revenueCents: number;
  completeness: DataCompleteness;
  limitations: string[];
}

export interface ServicePerformanceRow {
  /** Service label exactly as recorded upstream. Never normalised. */
  service: string;
  leadCount: number;
  quoteCount: number;
  jobCount: number;
  completedJobCount: number;
  /** Integer cents. */
  quotedValueCents: number;
  revenueCents: number;
  partsCostCents: number;
  grossMarginCents: number;
  /** completedJobCount / leadCount when leads exist, else null. */
  conversionRate: number | null;
  completeness: DataCompleteness;
}

export interface SourcePerformanceRow {
  /** Attribution source id, or "unknown" — never invented. */
  source: string;
  leadCount: number;
  qualifiedCount: number;
  quoteCount: number;
  jobCount: number;
  revenueCents: number;
  conversionRate: number | null;
  completeness: DataCompleteness;
}

export interface ProfitabilityReport {
  period: Period;
  /** Integer cents, from issued (non-void) invoices. */
  revenueCents: number;
  /** Integer cents, from recorded payments. */
  collectedCents: number;
  outstandingCents: number;
  /** Integer cents, from Parts usage records. */
  partsCostCents: number;
  /** Integer cents, billed labor value from Job labor entries. */
  laborRevenueCents: number;
  /**
   * Integer cents. Only populated when a labor COST basis exists. Skild OS
   * records labor at a billing rate, not a cost rate, so this is normally 0
   * with `laborCostKnown: false` — never a guess.
   */
  laborCostCents: number;
  laborCostKnown: boolean;
  /** revenue - partsCost - laborCost, in integer cents. May be negative. */
  grossMarginCents: number;
  completeness: DataCompleteness;
  limitations: string[];
  /** Invoices with no job link — revenue that cannot be attributed to work. */
  unlinkedInvoiceCount: number;
  /** Completed jobs with no invoice — work that cannot be attributed revenue. */
  uninvoicedJobCount: number;
}

export interface ExpectedVsActualRow {
  jobId: string;
  quoteId?: string;
  invoiceId?: string;
  /** Integer cents from the approved quote. */
  expectedRevenueCents?: number;
  /** Integer cents from the issued invoice. */
  actualRevenueCents?: number;
  varianceCents?: number;
  expectedLaborHours?: number;
  actualLaborHours?: number;
  expectedPartsCostCents?: number;
  actualPartsCostCents?: number;
  completeness: DataCompleteness;
  /** Which inputs were missing, when completeness is not "complete". */
  missing: string[];
}

export interface AttentionItem {
  id: string;
  kind:
    | "stale_lead"
    | "stale_quote"
    | "overdue_follow_up"
    | "outstanding_invoice"
    | "uninvoiced_job";
  title: string;
  detail: string;
  ageDays: number;
  /** Integer cents, when the item carries a monetary figure. */
  amountCents?: number;
  source: SourceRef;
}

export interface IntelligenceOverview {
  period: Period;
  generatedAt: number;
  metrics: MetricComputation[];
  profitability: ProfitabilityReport;
  funnel: FunnelReport;
  attention: AttentionItem[];
  openObservationCount: number;
  openOpportunityCount: number;
  proposedRecommendationCount: number;
  /** Modules whose repositories were unavailable when this was built. */
  unavailableModules: string[];
}

// ---- Optimization -------------------------------------------------------

export interface OptimizationThresholds {
  /** A lead with no response after this many ms is "stale". */
  staleLeadMs: number;
  /** A sent quote with no decision after this many ms is "aging". */
  quoteAgingMs: number;
  /** Open leads awaiting Skild above this count is a backlog. */
  followUpBacklogCount: number;
  /** Target first-response time in ms. */
  responseTargetMs: number;
  /** Relative increase (0..1) in per-unit parts cost that flags an anomaly. */
  partsCostIncreaseRatio: number;
  /** Relative change (0..1) in service demand that flags an opportunity. */
  serviceDemandChangeRatio: number;
}

export interface OptimizationResult {
  observations: Observation[];
  opportunities: IntelligenceOpportunity[];
  recommendations: Recommendation[];
  /** Rules that ran but produced nothing, with the reason. */
  skipped: Array<{ rule: string; reason: string }>;
}

// ---- Historical comparison ---------------------------------------------

/**
 * One metric measured over the current period next to the immediately
 * preceding period of equal length.
 *
 * `baselineAvailable: false` means the previous window contains no records
 * at all. In that case previousValue/change stay null — Skild OS never
 * invents a baseline to make a trend look measurable.
 */
export interface MetricComparisonRow {
  metricId: string;
  name: string;
  unit: MetricUnit;
  currentValue: number;
  previousValue: number | null;
  changeAbsolute: number | null;
  /** (current - previous) / previous. Null when previous is 0 or unknown. */
  changeRatio: number | null;
  baselineAvailable: boolean;
  /** Why no baseline exists, when baselineAvailable is false. */
  baselineReason?: string;
  completeness: DataCompleteness;
}

export interface ComparisonReport {
  period: Period;
  previousPeriod: Period;
  rows: MetricComparisonRow[];
  /** False when the previous window holds no source records whatsoever. */
  baselineAvailable: boolean;
  limitations: string[];
}
