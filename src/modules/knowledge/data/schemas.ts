// Knowledge domain types.
// This file holds only interfaces and small constant unions — no runtime
// dependencies. Zod is not used in Phase 3 (project has no Zod dependency);
// validation lives in the repository implementation. If Zod is added later,
// mirror these types with parsers here.

export type KnowledgeDocumentType =
  | "repair"
  | "sop"
  | "pricing_rule"
  | "business_rule"
  | "service_standard"
  | "brand_voice"
  | "lesson"
  | "decision"
  | "troubleshooting";

export const KNOWLEDGE_DOCUMENT_TYPES: KnowledgeDocumentType[] = [
  "repair",
  "sop",
  "pricing_rule",
  "business_rule",
  "service_standard",
  "brand_voice",
  "lesson",
  "decision",
  "troubleshooting",
];

export type KnowledgeStatus = "draft" | "active" | "archived";

export const KNOWLEDGE_STATUSES: KnowledgeStatus[] = [
  "draft",
  "active",
  "archived",
];

export interface KnowledgeDocument {
  id: string;
  type: KnowledgeDocumentType;
  title: string;
  summary: string;
  content: string;
  tags: string[];
  status: KnowledgeStatus;
  versionNumber: number;
  ownerId?: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  /**
   * Optional structured payload for `type === "pricing_rule"`.
   * Stored alongside `content` (freeform notes) so a future pricing engine
   * can execute rules without parsing markdown.
   */
  pricingRule?: PricingRulePayload;
}

export interface KnowledgeVersion {
  id: string;
  knowledgeDocumentId: string;
  versionNumber: number;
  content: string;
  changedBy: string;
  changeReason: string;
  createdAt: number;
}

export interface KnowledgeLink {
  id: string;
  knowledgeId: string;
  /**
   * Opaque type of the linked target (e.g. "vehicle.model", "job.type",
   * "inspection.template"). The Knowledge module does NOT import target
   * modules; consumers interpret this string.
   */
  targetType: string;
  /** Opaque id of the target. */
  targetId: string;
  createdAt: number;
}

/**
 * Pricing rule data. Storage-only in Phase 3 (no evaluation engine).
 * Persisted inside a `KnowledgeDocument` where `type === "pricing_rule"`.
 */
export interface PricingRulePayload {
  name: string;
  category: string;
  baseLabor: number;
  markupPercent: number;
  minimumMargin: number;
  approvalRequired: boolean;
}

// --- Repository input shapes ---------------------------------------------

export interface KnowledgeDocumentCreateInput {
  type: KnowledgeDocumentType;
  title: string;
  summary?: string;
  content: string;
  tags?: string[];
  status?: KnowledgeStatus;
  ownerId?: string;
  pricingRule?: PricingRulePayload;
}

export interface KnowledgeDocumentUpdateInput {
  title?: string;
  summary?: string;
  content?: string;
  tags?: string[];
  status?: KnowledgeStatus;
  ownerId?: string;
  pricingRule?: PricingRulePayload;
}

export interface KnowledgeDocumentListQuery {
  type?: KnowledgeDocumentType;
  status?: KnowledgeStatus;
  tag?: string;
  search?: string;
  limit?: number;
}

export interface KnowledgeLinkListQuery {
  knowledgeId?: string;
  targetType?: string;
  targetId?: string;
}

export interface KnowledgeLinkCreateInput {
  knowledgeId: string;
  targetType: string;
  targetId: string;
}
