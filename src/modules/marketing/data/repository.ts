// Marketing + Lead Machine repository — public interface only.
//
// The concrete local implementation lives in ./local-repository.ts and is
// registered at bootstrap under MARKETING_REPOSITORY. Consumers (route
// components, hooks, other modules, future automation) import ONLY from
// this file, so the implementation can later become server-backed or
// sync-backed without touching a single consumer.

import type {
  Lead,
  LeadAttentionItem,
  LeadChain,
  LeadConversionInput,
  LeadCreateInput,
  LeadListQuery,
  LeadLostReason,
  LeadQualification,
  LeadStatus,
  LeadUpdateInput,
  LocalVisibilityInput,
  LocalVisibilityRecord,
  MarketingAction,
  MarketingActionCreateInput,
  MarketingActionListQuery,
  MarketingOpportunity,
  MarketingOpportunityCreateInput,
  MarketingOpportunityListQuery,
  MarketingOpportunityUpdateInput,
  PagePerformanceInput,
  PagePerformanceRecord,
  RetentionOpportunity,
  SearchOpportunityInput,
  SearchOpportunityRecord,
  ServicePerformance,
  SourcePerformance,
  AttributionTouch,
} from "./schemas";

export const MARKETING_REPOSITORY = "marketing.repository";

export interface MarketingRepository {
  // ---- Leads ------------------------------------------------------------
  listLeads(query?: LeadListQuery): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  createLead(input: LeadCreateInput): Promise<Lead>;
  updateLead(id: string, patch: LeadUpdateInput): Promise<Lead>;
  /** Move lifecycle state. Rejects transitions outside LEAD_TRANSITIONS. */
  setLeadStatus(id: string, status: LeadStatus): Promise<Lead>;
  /** Record that a human touched the lead. Does NOT send anything. */
  recordContact(id: string, at?: number): Promise<Lead>;
  setQualification(
    id: string,
    qualification: LeadQualification,
  ): Promise<Lead>;
  scheduleFollowUp(id: string, at: number | null): Promise<Lead>;
  /** Attach conversion ids owned by other modules. Never copies their data. */
  recordConversion(id: string, links: LeadConversionInput): Promise<Lead>;
  markLost(
    id: string,
    reason: LeadLostReason,
    detail?: string,
  ): Promise<Lead>;
  /** Record a later attribution touch (updates lastTouch only). */
  recordTouch(
    id: string,
    touch: Omit<AttributionTouch, "at"> & { at?: number },
  ): Promise<Lead>;
  /** Idempotency lookup for inbound adapters replaying the same event. */
  findLeadByExternalRef(
    integrationId: string,
    externalRef: string,
  ): Promise<Lead | undefined>;
  findLeadByServiceRequest(
    serviceRequestId: string,
  ): Promise<Lead | undefined>;

  // ---- Derived lead intelligence ---------------------------------------
  /**
   * Leads that need a human. Computed on read from timestamps and status —
   * never stored, so it cannot drift.
   */
  listLeadsNeedingAttention(opts?: {
    now?: number;
    staleAfterMs?: number;
  }): Promise<LeadAttentionItem[]>;
  /** Reconstruct the Lead → Customer → … → Invoice chain from ids only. */
  getLeadChain(id: string): Promise<LeadChain | undefined>;
  getSourcePerformance(): Promise<SourcePerformance[]>;
  getServicePerformance(): Promise<ServicePerformance[]>;
  /**
   * Previous customers with completed work who may warrant a follow-up.
   * Derived from Jobs via the Data Registry; invents no service intervals.
   */
  listRetentionOpportunities(opts?: {
    now?: number;
    minDays?: number;
  }): Promise<RetentionOpportunity[]>;

  // ---- Marketing opportunities -----------------------------------------
  listOpportunities(
    query?: MarketingOpportunityListQuery,
  ): Promise<MarketingOpportunity[]>;
  getOpportunity(id: string): Promise<MarketingOpportunity | undefined>;
  createOpportunity(
    input: MarketingOpportunityCreateInput,
  ): Promise<MarketingOpportunity>;
  updateOpportunity(
    id: string,
    patch: MarketingOpportunityUpdateInput,
  ): Promise<MarketingOpportunity>;
  reviewOpportunity(id: string): Promise<MarketingOpportunity>;
  /** Requires marketing.approve at the call site. */
  approveOpportunity(id: string): Promise<MarketingOpportunity>;
  dismissOpportunity(
    id: string,
    reason?: string,
  ): Promise<MarketingOpportunity>;

  // ---- Marketing actions ------------------------------------------------
  listActions(query?: MarketingActionListQuery): Promise<MarketingAction[]>;
  getAction(id: string): Promise<MarketingAction | undefined>;
  createAction(input: MarketingActionCreateInput): Promise<MarketingAction>;
  reviewAction(id: string): Promise<MarketingAction>;
  approveAction(id: string, approvedBy?: string): Promise<MarketingAction>;
  /**
   * Records that a human performed the action. Phase 11 publishes nothing;
   * this only writes history.
   */
  markActionExecuted(id: string, note?: string): Promise<MarketingAction>;
  measureAction(id: string, outcome: string): Promise<MarketingAction>;
  rejectAction(id: string, reason?: string): Promise<MarketingAction>;

  // ---- Website / search / local intelligence ----------------------------
  // These are INGESTION points for measured data. Nothing here fabricates
  // metrics; a record always carries its evidence source.
  listPagePerformance(page?: string): Promise<PagePerformanceRecord[]>;
  recordPagePerformance(
    input: PagePerformanceInput,
  ): Promise<PagePerformanceRecord>;
  listSearchOpportunities(
    status?: SearchOpportunityRecord["status"],
  ): Promise<SearchOpportunityRecord[]>;
  recordSearchOpportunity(
    input: SearchOpportunityInput,
  ): Promise<SearchOpportunityRecord>;
  listLocalVisibility(): Promise<LocalVisibilityRecord[]>;
  recordLocalVisibility(
    input: LocalVisibilityInput,
  ): Promise<LocalVisibilityRecord>;

  /** Subscribe to any change; consumers use this to refresh. */
  subscribe(listener: () => void): () => void;
}
