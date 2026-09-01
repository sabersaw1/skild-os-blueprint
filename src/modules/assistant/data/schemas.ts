// Jarvis domain types (Phase 12).
//
// Interfaces + constant unions only. Jarvis owns NO business records: every
// structure below is either a *reference* to a record owned by another
// module (via `SourceRef`) or an *interpretation* clearly marked as such.
//
// THE EVIDENCE RULE
// Nothing Jarvis says is allowed to lose its provenance. Every fact carries
// an EvidenceKind and the source ids it came from, so an AI-generated
// sentence can never silently become verified business knowledge.

export type EvidenceKind =
  /** Read directly from an authoritative repository record. */
  | "verified_fact"
  /** Supplied by a customer (lead text, inbound message). Unverified. */
  | "customer_provided"
  /** Computed by Skild OS from verified records (counts, sums, ages). */
  | "system_derived"
  /** Produced by the assistant. Never business truth. */
  | "ai_generated"
  /** Explicitly flagged uncertainty or a missing record. */
  | "assumption";

export const EVIDENCE_KINDS: EvidenceKind[] = [
  "verified_fact",
  "customer_provided",
  "system_derived",
  "ai_generated",
  "assumption",
];

/** Kinds that may be presented to a human as business truth. */
export const AUTHORITATIVE_EVIDENCE_KINDS: EvidenceKind[] = [
  "verified_fact",
  "system_derived",
];

/**
 * Pointer to a record owned by another module. Ids only — Jarvis never
 * copies the record itself.
 */
export interface SourceRef {
  /** Owning module id, e.g. "jobs", "finance", "marketing". */
  module: string;
  /** Entity name, singular: "job", "invoice", "lead". */
  entity: string;
  /** Opaque record id from that module's repository. */
  id: string;
}

export interface Fact {
  id: string;
  /** Plain-language statement, rendered verbatim in the UI. */
  statement: string;
  kind: EvidenceKind;
  sources: SourceRef[];
  /** Optional structured value behind the statement (count, cents, ms). */
  value?: number;
  unit?: "count" | "cents" | "hours" | "days" | "ms";
}

export interface KnowledgeCitation {
  knowledgeId: string;
  title: string;
  type: string;
  versionNumber: number;
  summary: string;
}

export type Confidence = "low" | "medium" | "high";

export interface Recommendation {
  id: string;
  title: string;
  /** Why Jarvis surfaced this. Required — a reasonless recommendation is a bug. */
  reason: string;
  confidence: Confidence;
  /** Facts the recommendation rests on. May be empty only for assumptions. */
  basis: Fact[];
  sources: SourceRef[];
  /** Proposal this recommendation could become, if a human wants it. */
  suggestedProposalType?: ProposalActionType;
  createdAt: number;
}

// ---- Attention ----------------------------------------------------------

export type AttentionCategory =
  | "new_lead"
  | "stale_lead"
  | "unanswered_communication"
  | "quote_awaiting_response"
  | "job_awaiting_parts"
  | "incomplete_job"
  | "scheduling_conflict"
  | "unpaid_invoice"
  | "review_opportunity"
  | "marketing_opportunity"
  | "retention_opportunity";

export const ATTENTION_CATEGORIES: AttentionCategory[] = [
  "new_lead",
  "stale_lead",
  "unanswered_communication",
  "quote_awaiting_response",
  "job_awaiting_parts",
  "incomplete_job",
  "scheduling_conflict",
  "unpaid_invoice",
  "review_opportunity",
  "marketing_opportunity",
  "retention_opportunity",
];

export type AttentionPriority = "low" | "normal" | "high" | "urgent";

export type AttentionStatus = "open" | "acknowledged" | "dismissed";

export interface AttentionItem {
  /** Stable, deterministic: `att:<category>:<primary source id>`. */
  id: string;
  category: AttentionCategory;
  priority: AttentionPriority;
  title: string;
  reason: string;
  sources: SourceRef[];
  evidence: Fact[];
  createdAt: number;
  status: AttentionStatus;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
}

/** Persisted human decision on a derived attention item. */
export interface AttentionAcknowledgement {
  attentionId: string;
  status: Exclude<AttentionStatus, "open">;
  at: number;
  by: string;
  note?: string;
}

// ---- AI action proposals ------------------------------------------------

export type ProposalActionType =
  | "follow_up_lead"
  | "follow_up_quote"
  | "request_review"
  | "retention_outreach"
  | "order_parts"
  | "schedule_job"
  | "invoice_reminder"
  | "publish_marketing_content";

export const PROPOSAL_ACTION_TYPES: ProposalActionType[] = [
  "follow_up_lead",
  "follow_up_quote",
  "request_review",
  "retention_outreach",
  "order_parts",
  "schedule_job",
  "invoice_reminder",
  "publish_marketing_content",
];

export type ProposalRisk = "low" | "medium" | "high";

export type ProposalApprovalState =
  | "pending"
  | "approved"
  | "rejected"
  | "expired";

/**
 * Phase 12 never executes. `executed_by_human` only records that a person
 * did the thing themselves, exactly like Marketing actions in Phase 11.
 */
export type ProposalExecutionState = "not_executed" | "executed_by_human";

/**
 * Capability a future executor would need. Declared per action type so the
 * requirement is data, not a code branch a Phase 13 agent could skip.
 */
export const PROPOSAL_REQUIRED_CAPABILITY: Record<
  ProposalActionType,
  string
> = {
  follow_up_lead: "communication.send",
  follow_up_quote: "communication.send",
  request_review: "communication.send",
  retention_outreach: "communication.send",
  order_parts: "parts.purchase.write",
  schedule_job: "jobs.write",
  invoice_reminder: "communication.send",
  publish_marketing_content: "marketing.publish",
};

/** Risk floor per action type. A proposal may never be recorded below it. */
export const PROPOSAL_MINIMUM_RISK: Record<ProposalActionType, ProposalRisk> = {
  follow_up_lead: "low",
  follow_up_quote: "low",
  request_review: "low",
  retention_outreach: "low",
  order_parts: "high",
  schedule_job: "medium",
  invoice_reminder: "medium",
  publish_marketing_content: "high",
};

export interface AiActionProposal {
  id: string;
  actionType: ProposalActionType;
  title: string;
  /** Records this proposal concerns. Ids only. */
  targets: SourceRef[];
  reason: string;
  evidence: Fact[];
  risk: ProposalRisk;
  requiredCapabilityId: string;
  approval: ProposalApprovalState;
  execution: ProposalExecutionState;
  generatedAt: number;
  updatedAt: number;
  generatedBy: string;
  /** Provider that produced the wording, if any. "deterministic" by default. */
  providerId: string;
  expiresAt?: number;
  decidedAt?: number;
  decidedBy?: string;
  rejectedReason?: string;
  executedAt?: number;
  executionNote?: string;
  /** Recommendation this proposal came from, when applicable. */
  recommendationId?: string;
}

export interface ProposalCreateInput {
  actionType: ProposalActionType;
  title: string;
  targets: SourceRef[];
  reason: string;
  evidence?: Fact[];
  risk?: ProposalRisk;
  expiresAt?: number;
  providerId?: string;
  recommendationId?: string;
}

export interface ProposalListQuery {
  actionType?: ProposalActionType;
  approval?: ProposalApprovalState;
  execution?: ProposalExecutionState;
  risk?: ProposalRisk;
  limit?: number;
}

// ---- Answers ------------------------------------------------------------

export interface JarvisAnswer {
  id: string;
  /** Normalised question text. Not persisted, not emitted in activity. */
  question: string;
  intent: IntentType;
  intentConfidence: Confidence;
  /** One-paragraph grounded summary composed by the model provider. */
  summary: string;
  facts: Fact[];
  recommendations: Recommendation[];
  attention: AttentionItem[];
  knowledge: KnowledgeCitation[];
  /** Explicit statements of what Jarvis does NOT know. Never empty-washed. */
  uncertainty: string[];
  /** Capabilities the caller lacked; the answer is scoped accordingly. */
  blockedByCapabilities: string[];
  providerId: string;
  generatedAt: number;
}

// ---- Intent -------------------------------------------------------------

export type IntentType =
  | "operational.today"
  | "operational.upcoming"
  | "operational.attention"
  | "leads.new"
  | "leads.follow_up"
  | "quotes.pending"
  | "jobs.incomplete"
  | "jobs.awaiting_parts"
  | "finance.unpaid"
  | "finance.revenue"
  | "customer.history"
  | "vehicle.history"
  | "parts.job_cost"
  | "marketing.performance"
  | "marketing.opportunities"
  | "knowledge.lookup"
  | "automation.status"
  | "brief.daily"
  | "unknown";

export interface ClassifiedIntent {
  type: IntentType;
  confidence: Confidence;
  matchedTerms: string[];
  /** Free-text entity hints extracted from the question (names, plates). */
  entityHints: string[];
}

// ---- Daily brief --------------------------------------------------------

export interface DailyBriefSection {
  id: string;
  label: string;
  /** Rendered as-is. Derived from counts, never invented. */
  lines: Fact[];
}

export interface DailyBrief {
  generatedAt: number;
  greeting: string;
  sections: DailyBriefSection[];
  attentionCount: number;
  /** Areas the caller could not see due to capabilities. */
  omitted: string[];
}
