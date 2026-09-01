// Marketing + Lead Machine domain types (Phase 11).
//
// Interfaces + constant unions ONLY. Validation lives in the repository
// (see ./local-repository.ts).
//
// RULES
//  * Marketing is an INTELLIGENCE / ATTRIBUTION domain. It never duplicates
//    Customer, Vehicle, Quote, Job, Invoice, Payment, or Message records —
//    it stores opaque ids owned by the modules that are the source of truth
//    and resolves them through the Data Registry.
//  * Provider-agnostic. No Google Analytics / Search Console / GBP / Meta
//    concepts leak in here. External identifiers live behind the Phase 9
//    integration boundary (`integrationId` + `externalRef` only).
//  * All timestamps are epoch milliseconds (UTC).
//  * Money, where present, is integer cents (see @/core/money).
//  * Nothing in this module transmits, publishes, or spends anything.

// ---- Attribution --------------------------------------------------------

/**
 * Where a lead came from, as a structured class — never vendor logic.
 * Adding a provider adds an adapter (Phase 9), not a source type.
 */
export type LeadSource =
  | "website"
  | "google_business_profile"
  | "organic_search"
  | "direct"
  | "email"
  | "referral"
  | "existing_customer"
  | "social"
  | "campaign"
  | "phone"
  | "walk_in"
  | "other";

export const LEAD_SOURCES: LeadSource[] = [
  "website",
  "google_business_profile",
  "organic_search",
  "direct",
  "email",
  "referral",
  "existing_customer",
  "social",
  "campaign",
  "phone",
  "walk_in",
  "other",
];

/** How the person reached us. Mirrors Communication channels by intent. */
export type LeadChannel =
  | "website_form"
  | "email"
  | "sms"
  | "phone"
  | "messaging"
  | "in_person"
  | "other";

export const LEAD_CHANNELS: LeadChannel[] = [
  "website_form",
  "email",
  "sms",
  "phone",
  "messaging",
  "in_person",
  "other",
];

/**
 * A single attribution touch. First touch is recorded at creation; last
 * touch is updated when a later, better-attributed interaction arrives.
 * Deliberately NOT a full multi-touch model — that is a later phase.
 */
export interface AttributionTouch {
  source: LeadSource;
  /** Marketing medium/channel grouping, e.g. "organic", "referral". */
  medium?: string;
  /** Free-form campaign label. Never an ad-account id. */
  campaign?: string;
  /** Site path the visitor landed on, e.g. "/services/brake-repair". */
  landingPage?: string;
  /** Who or what referred them (person, shop, directory name). */
  referralSource?: string;
  /** Extra human-readable detail about the source. */
  sourceDetail?: string;
  /** Phase 9 connection that reported this touch, when any. */
  integrationId?: string;
  /** Opaque provider-side id, recorded for idempotency only. */
  externalRef?: string;
  at: number;
}

export interface LeadAttribution {
  firstTouch: AttributionTouch;
  lastTouch: AttributionTouch;
}

// ---- Lead lifecycle -----------------------------------------------------

export type LeadStatus =
  | "new"
  | "contacted"
  | "awaiting_customer"
  | "qualifying"
  | "qualified"
  | "quote_prepared"
  | "quote_sent"
  | "considering"
  | "scheduled"
  | "won"
  | "lost"
  | "follow_up";

export const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "awaiting_customer",
  "qualifying",
  "qualified",
  "quote_prepared",
  "quote_sent",
  "considering",
  "scheduled",
  "won",
  "lost",
  "follow_up",
];

/** Terminal states. No further pipeline movement is expected. */
export const CLOSED_LEAD_STATUSES: LeadStatus[] = ["won", "lost"];

/**
 * Allowed transitions. `won` / `lost` are terminal; every non-terminal
 * state may move to `lost` (a lead can die at any point) and to
 * `follow_up` (parked, revisit later).
 */
export const LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new: ["contacted", "qualifying", "awaiting_customer", "follow_up", "lost"],
  contacted: [
    "qualifying",
    "awaiting_customer",
    "qualified",
    "follow_up",
    "lost",
  ],
  awaiting_customer: ["qualifying", "qualified", "considering", "follow_up", "lost"],
  qualifying: ["qualified", "awaiting_customer", "follow_up", "lost"],
  qualified: ["quote_prepared", "scheduled", "awaiting_customer", "follow_up", "lost"],
  quote_prepared: ["quote_sent", "follow_up", "lost"],
  quote_sent: ["considering", "scheduled", "awaiting_customer", "follow_up", "lost"],
  considering: ["scheduled", "quote_sent", "follow_up", "lost"],
  scheduled: ["won", "follow_up", "lost"],
  follow_up: [
    "contacted",
    "qualifying",
    "qualified",
    "quote_sent",
    "considering",
    "scheduled",
    "lost",
  ],
  won: [],
  lost: ["follow_up"],
};

/** Who the lead is blocked on right now. Derived from status. */
export type LeadAwaitingParty = "customer" | "skild" | "none";

export type LeadQualification =
  | "unknown"
  | "needs_information"
  | "qualified"
  | "not_a_fit"
  | "out_of_area"
  | "duplicate";

export const LEAD_QUALIFICATIONS: LeadQualification[] = [
  "unknown",
  "needs_information",
  "qualified",
  "not_a_fit",
  "out_of_area",
  "duplicate",
];

export type LeadLostReason =
  | "no_response"
  | "price"
  | "timing"
  | "went_elsewhere"
  | "out_of_scope"
  | "out_of_area"
  | "duplicate"
  | "not_real"
  | "other";

export const LEAD_LOST_REASONS: LeadLostReason[] = [
  "no_response",
  "price",
  "timing",
  "went_elsewhere",
  "out_of_scope",
  "out_of_area",
  "duplicate",
  "not_real",
  "other",
];

export type LeadUrgency = "low" | "normal" | "high" | "emergency";

export const LEAD_URGENCIES: LeadUrgency[] = [
  "low",
  "normal",
  "high",
  "emergency",
];

// ---- Lead ---------------------------------------------------------------

export interface Lead {
  id: string;
  /** CRM customer, when known. CRM remains the source of truth. */
  customerId?: string;
  /** Vehicles module id, when known. */
  vehicleId?: string;
  /** Phase 10 conversation carrying the actual messages. Never duplicated. */
  conversationId?: string;
  /** Phase 10 service request this lead was captured from, when any. */
  serviceRequestId?: string;

  channel: LeadChannel;
  status: LeadStatus;
  awaitingParty: LeadAwaitingParty;
  qualification: LeadQualification;

  /** Service the person asked for, in Skild's own vocabulary. */
  serviceRequested?: string;
  requestSummary?: string;
  /** Free-text service area / city. Not a geocoded record. */
  location?: string;
  urgency?: LeadUrgency;

  attribution: LeadAttribution;

  /** Conversion links — opaque ids owned by other modules. */
  quoteId?: string;
  appointmentId?: string;
  jobId?: string;
  invoiceId?: string;

  lostReason?: LeadLostReason;
  lostDetail?: string;

  /** Deterministic, explainable score. See ./scoring.ts. */
  score: number;
  scoreReasons: string[];

  createdAt: number;
  updatedAt: number;
  firstResponseAt?: number;
  lastContactAt?: number;
  nextFollowUpAt?: number;

  tags?: string[];
  /** Attribution-safe metadata only. Never secrets or contact details. */
  metadata?: Record<string, string>;
}

export interface LeadCreateInput {
  customerId?: string;
  vehicleId?: string;
  conversationId?: string;
  serviceRequestId?: string;
  channel: LeadChannel;
  status?: LeadStatus;
  qualification?: LeadQualification;
  serviceRequested?: string;
  requestSummary?: string;
  location?: string;
  urgency?: LeadUrgency;
  /** First touch. Also seeds last touch. */
  attribution: Omit<AttributionTouch, "at"> & { at?: number };
  nextFollowUpAt?: number;
  tags?: string[];
  metadata?: Record<string, string>;
}

export interface LeadUpdateInput {
  customerId?: string;
  vehicleId?: string;
  conversationId?: string;
  serviceRequestId?: string;
  serviceRequested?: string;
  requestSummary?: string;
  location?: string;
  urgency?: LeadUrgency;
  qualification?: LeadQualification;
  nextFollowUpAt?: number | null;
  tags?: string[];
  metadata?: Record<string, string>;
}

export interface LeadConversionInput {
  quoteId?: string;
  appointmentId?: string;
  jobId?: string;
  invoiceId?: string;
}

export interface LeadListQuery {
  status?: LeadStatus;
  source?: LeadSource;
  channel?: LeadChannel;
  qualification?: LeadQualification;
  customerId?: string;
  serviceRequested?: string;
  awaitingParty?: LeadAwaitingParty;
  /** Only leads whose last touch is at or before this epoch ms. */
  staleSince?: number;
  /** Only leads with a follow-up due at or before this epoch ms. */
  followUpDueBy?: number;
  open?: boolean;
  search?: string;
  limit?: number;
}

/**
 * Derived "nothing gets missed" view. Computed, never stored — so it can
 * never drift from the lead record.
 */
export interface LeadAttentionItem {
  leadId: string;
  reasons: LeadAttentionReason[];
  /** Epoch ms of the most recent human touch (or creation). */
  lastTouchedAt: number;
  nextFollowUpAt?: number;
}

export type LeadAttentionReason =
  | "never_contacted"
  | "awaiting_skild"
  | "follow_up_due"
  | "follow_up_overdue"
  | "stale"
  | "quote_sent_no_response";

// ---- Marketing opportunities -------------------------------------------

export type MarketingOpportunityType =
  | "service_demand"
  | "search_query"
  | "page_performance"
  | "content_from_job"
  | "local_area"
  | "conversion"
  | "technical_seo"
  | "listing_profile";

export const MARKETING_OPPORTUNITY_TYPES: MarketingOpportunityType[] = [
  "service_demand",
  "search_query",
  "page_performance",
  "content_from_job",
  "local_area",
  "conversion",
  "technical_seo",
  "listing_profile",
];

export type MarketingOpportunityStatus =
  | "identified"
  | "reviewing"
  | "approved"
  | "dismissed"
  | "actioned";

export const MARKETING_OPPORTUNITY_STATUSES: MarketingOpportunityStatus[] = [
  "identified",
  "reviewing",
  "approved",
  "dismissed",
  "actioned",
];

/**
 * Where the belief came from. `manual` = a human wrote it down.
 * `integration` = a Phase 9 adapter reported measured data.
 * `derived` = computed from Skild's own records. There is no
 * "the model felt like it" source.
 */
export type EvidenceSource = "manual" | "integration" | "derived";

export const EVIDENCE_SOURCES: EvidenceSource[] = [
  "manual",
  "integration",
  "derived",
];

export interface MarketingOpportunity {
  id: string;
  type: MarketingOpportunityType;
  title: string;
  /** Service in Skild's vocabulary this concerns, when applicable. */
  service?: string;
  /** Free-text geographic area, e.g. "Denver metro". */
  area?: string;
  /** Search query or content topic, when applicable. */
  topic?: string;
  /** Page path this concerns, when applicable. */
  page?: string;
  /** Source job this content opportunity came from — real work only. */
  jobId?: string;
  /** Knowledge document backing this, referenced not copied. */
  knowledgeDocumentId?: string;

  evidenceSource: EvidenceSource;
  /** Human-readable evidence. Never fabricated metrics. */
  evidence?: string;
  /** 0–100. Explainable, human-set or rule-derived. Never an LLM guess. */
  confidence: number;
  recommendation?: string;

  status: MarketingOpportunityStatus;
  createdAt: number;
  updatedAt: number;
  reviewedAt?: number;
  approvedAt?: number;
  dismissedAt?: number;
  dismissReason?: string;
  /** The MarketingAction created from this opportunity, when any. */
  actionId?: string;
}

export interface MarketingOpportunityCreateInput {
  type: MarketingOpportunityType;
  title: string;
  service?: string;
  area?: string;
  topic?: string;
  page?: string;
  jobId?: string;
  knowledgeDocumentId?: string;
  evidenceSource: EvidenceSource;
  evidence?: string;
  confidence?: number;
  recommendation?: string;
}

export interface MarketingOpportunityUpdateInput {
  title?: string;
  service?: string;
  area?: string;
  topic?: string;
  page?: string;
  evidence?: string;
  confidence?: number;
  recommendation?: string;
}

export interface MarketingOpportunityListQuery {
  type?: MarketingOpportunityType;
  status?: MarketingOpportunityStatus;
  service?: string;
  jobId?: string;
  limit?: number;
}

// ---- Marketing actions --------------------------------------------------

export type MarketingActionType =
  | "seo_improvement"
  | "content_draft"
  | "service_page"
  | "internal_linking"
  | "listing_update"
  | "social_content"
  | "case_study"
  | "conversion_improvement"
  | "technical_fix";

export const MARKETING_ACTION_TYPES: MarketingActionType[] = [
  "seo_improvement",
  "content_draft",
  "service_page",
  "internal_linking",
  "listing_update",
  "social_content",
  "case_study",
  "conversion_improvement",
  "technical_fix",
];

/**
 * recommended → reviewed → approved → executed → measured.
 * `approved` requires `marketing.approve`; anything that would become
 * publicly visible additionally requires `marketing.publish` at execution.
 */
export type MarketingActionStatus =
  | "recommended"
  | "reviewed"
  | "approved"
  | "executed"
  | "measured"
  | "rejected";

export const MARKETING_ACTION_STATUSES: MarketingActionStatus[] = [
  "recommended",
  "reviewed",
  "approved",
  "executed",
  "measured",
  "rejected",
];

export const MARKETING_ACTION_TRANSITIONS: Record<
  MarketingActionStatus,
  MarketingActionStatus[]
> = {
  recommended: ["reviewed", "rejected"],
  reviewed: ["approved", "rejected"],
  approved: ["executed", "rejected"],
  executed: ["measured"],
  measured: [],
  rejected: [],
};

/** Action types whose execution puts something in front of the public. */
export const PUBLIC_ACTION_TYPES: MarketingActionType[] = [
  "content_draft",
  "service_page",
  "listing_update",
  "social_content",
  "case_study",
];

export interface MarketingAction {
  id: string;
  opportunityId?: string;
  type: MarketingActionType;
  title: string;
  description?: string;
  /** Target page/profile the action concerns. */
  target?: string;
  /** True when executing would publish publicly. Requires marketing.publish. */
  publicFacing: boolean;
  status: MarketingActionStatus;
  createdAt: number;
  updatedAt: number;
  reviewedAt?: number;
  approvedAt?: number;
  approvedBy?: string;
  executedAt?: number;
  measuredAt?: number;
  /** Human-recorded outcome after measurement. Never auto-invented. */
  outcome?: string;
  rejectedReason?: string;
}

export interface MarketingActionCreateInput {
  opportunityId?: string;
  type: MarketingActionType;
  title: string;
  description?: string;
  target?: string;
  publicFacing?: boolean;
}

export interface MarketingActionListQuery {
  status?: MarketingActionStatus;
  type?: MarketingActionType;
  opportunityId?: string;
  limit?: number;
}

// ---- Website intelligence (provider-agnostic, integration-fed) ---------

/**
 * A measured website performance record for one page over one date range.
 * Phase 11 NEVER generates these — they arrive from a Phase 9 integration
 * or are entered by a human. `evidenceSource` records which.
 */
export interface PagePerformanceRecord {
  id: string;
  page: string;
  periodStart: number;
  periodEnd: number;
  visits?: number;
  landingSessions?: number;
  quoteRequests?: number;
  schedulingStarts?: number;
  conversions?: number;
  source?: LeadSource;
  evidenceSource: EvidenceSource;
  integrationId?: string;
  externalRef?: string;
  recordedAt: number;
}

export type PagePerformanceInput = Omit<
  PagePerformanceRecord,
  "id" | "recordedAt"
>;

/** A measured search query record. Never scraped, never manufactured. */
export interface SearchOpportunityRecord {
  id: string;
  query: string;
  service?: string;
  area?: string;
  impressions?: number;
  clicks?: number;
  /** 0–1 fraction. Derived when clicks + impressions are both present. */
  ctr?: number;
  /** Average position. Lower is better. */
  position?: number;
  targetPage?: string;
  /** 0–100, rule-derived. See ./scoring.ts. */
  opportunityScore: number;
  scoreReasons: string[];
  status: MarketingOpportunityStatus;
  evidenceSource: EvidenceSource;
  integrationId?: string;
  externalRef?: string;
  periodStart: number;
  periodEnd: number;
  recordedAt: number;
}

export type SearchOpportunityInput = Omit<
  SearchOpportunityRecord,
  "id" | "recordedAt" | "opportunityScore" | "scoreReasons" | "status"
> & { status?: MarketingOpportunityStatus };

/** Local visibility (e.g. a business profile) — provider-agnostic. */
export interface LocalVisibilityRecord {
  id: string;
  /** Opaque profile label; not a vendor account id. */
  profile: string;
  periodStart: number;
  periodEnd: number;
  views?: number;
  calls?: number;
  websiteActions?: number;
  directionRequests?: number;
  reviewCount?: number;
  averageRating?: number;
  evidenceSource: EvidenceSource;
  integrationId?: string;
  externalRef?: string;
  recordedAt: number;
}

export type LocalVisibilityInput = Omit<
  LocalVisibilityRecord,
  "id" | "recordedAt"
>;

// ---- Read models (computed, never stored) -------------------------------

export interface SourcePerformance {
  source: LeadSource;
  leads: number;
  qualified: number;
  quoted: number;
  scheduled: number;
  won: number;
  lost: number;
  /** Count of won leads that carry an invoiceId. Finance owns the amounts. */
  invoiced: number;
}

export interface ServicePerformance {
  service: string;
  leads: number;
  qualified: number;
  quoted: number;
  jobs: number;
  won: number;
  lost: number;
}

/**
 * The Lead → business chain, reconstructed from ids. Every field is an
 * opaque reference into the owning module — nothing is copied here.
 */
export interface LeadChain {
  leadId: string;
  customerId?: string;
  vehicleId?: string;
  conversationId?: string;
  quoteId?: string;
  appointmentId?: string;
  jobId?: string;
  invoiceId?: string;
}

/** A previous customer whose history suggests a possible follow-up. */
export interface RetentionOpportunity {
  customerId: string;
  lastJobId?: string;
  lastJobAt?: number;
  /** Days since the last recorded completed work. */
  daysSinceLastJob?: number;
  /** Why this surfaced. Never an invented maintenance interval. */
  reasons: string[];
}
