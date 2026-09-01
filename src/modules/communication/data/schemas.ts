// Customer Communication domain types (Phase 10).
//
// Interfaces + constant unions ONLY. Validation lives in the repository
// (see ./local-repository.ts).
//
// RULES
//  * This module NEVER duplicates CRM / Vehicles / Quotes / Jobs / Finance
//    data. It stores opaque ids and resolves them through the Data Registry.
//  * The model is provider-agnostic. No Gmail / Twilio / Meta concepts leak
//    in here — external providers live behind the Phase 9 integration layer.
//  * All timestamps are epoch milliseconds (UTC). Display formatting for
//    America/Denver lives in ./time.ts — never store ambiguous local strings.

// ---- Channels -----------------------------------------------------------

/**
 * Provider-agnostic transport classes. A channel says HOW we talked, never
 * WHICH vendor carried it — the vendor is `integrationId` (Phase 9).
 */
export type CommunicationChannel =
  | "website"
  | "email"
  | "sms"
  | "phone"
  | "in_person"
  | "messaging"
  | "other";

export const COMMUNICATION_CHANNELS: CommunicationChannel[] = [
  "website",
  "email",
  "sms",
  "phone",
  "in_person",
  "messaging",
  "other",
];

// ---- Cross-module references -------------------------------------------

/**
 * Business entities a conversation or message may concern. Referenced by
 * opaque id only; the owning module remains the source of truth.
 */
export type EntityRefType =
  | "customer"
  | "vehicle"
  | "inspection"
  | "quote"
  | "job"
  | "invoice"
  | "payment"
  | "appointment"
  | "service_request"
  | "review_request";

export const ENTITY_REF_TYPES: EntityRefType[] = [
  "customer",
  "vehicle",
  "inspection",
  "quote",
  "job",
  "invoice",
  "payment",
  "appointment",
  "service_request",
  "review_request",
];

export interface EntityRef {
  type: EntityRefType;
  /** Opaque id owned by the referenced module. Never parsed. */
  id: string;
}

// ---- Conversation -------------------------------------------------------

export type ConversationStatus =
  | "open"
  | "awaiting_customer"
  | "awaiting_skild"
  | "resolved"
  | "closed";

export const CONVERSATION_STATUSES: ConversationStatus[] = [
  "open",
  "awaiting_customer",
  "awaiting_skild",
  "resolved",
  "closed",
];

/** Terminal states — no further replies are expected. */
export const CLOSED_CONVERSATION_STATUSES: ConversationStatus[] = [
  "resolved",
  "closed",
];

/** Who the thread is currently blocked on. Derived from status. */
export type AwaitingParty = "customer" | "skild" | "none";

export interface Conversation {
  id: string;
  customerId: string;
  vehicleId?: string;
  channel: CommunicationChannel;
  status: ConversationStatus;
  awaitingParty: AwaitingParty;
  subject?: string;
  /** Free-form origin label, e.g. "website.contact-form". Not a vendor id. */
  source?: string;
  /** Phase 9 integration connection that carries this thread, when any. */
  integrationId?: string;
  /** Provider thread id (Gmail thread, SMS conversation) — opaque. */
  externalThreadId?: string;
  /** Business entities this thread concerns. Ids only. */
  refs: EntityRef[];
  tags?: string[];
  createdAt: number;
  updatedAt: number;
  lastMessageAt?: number;
  /** Last time the CUSTOMER said something. Enables stale detection later. */
  lastCustomerMessageAt?: number;
  /** Last time SKILD said something. */
  lastOutboundMessageAt?: number;
  createdBy: string;
}

export interface ConversationCreateInput {
  customerId: string;
  vehicleId?: string;
  channel: CommunicationChannel;
  subject?: string;
  source?: string;
  integrationId?: string;
  externalThreadId?: string;
  refs?: EntityRef[];
  tags?: string[];
  status?: ConversationStatus;
}

export interface ConversationUpdateInput {
  vehicleId?: string | null;
  subject?: string | null;
  source?: string | null;
  tags?: string[];
  refs?: EntityRef[];
}

export interface ConversationListQuery {
  customerId?: string;
  vehicleId?: string;
  channel?: CommunicationChannel;
  status?: ConversationStatus;
  awaitingParty?: AwaitingParty;
  /** Match conversations referencing this entity. */
  ref?: EntityRef;
  /** Only threads with no activity since this epoch ms. */
  inactiveSince?: number;
  search?: string;
  limit?: number;
}

// ---- Message ------------------------------------------------------------

export type MessageDirection = "inbound" | "outbound" | "internal";

export const MESSAGE_DIRECTIONS: MessageDirection[] = [
  "inbound",
  "outbound",
  "internal",
];

/**
 * Semantic purpose of a message. Automation and analytics key off this;
 * it is NOT a template engine and carries no provider formatting.
 */
export type MessageType =
  | "general"
  | "internal_note"
  | "service_request"
  | "quote_notification"
  | "appointment_confirmation"
  | "appointment_reminder"
  | "job_status"
  | "invoice_notification"
  | "payment_confirmation"
  | "review_request"
  | "follow_up";

export const MESSAGE_TYPES: MessageType[] = [
  "general",
  "internal_note",
  "service_request",
  "quote_notification",
  "appointment_confirmation",
  "appointment_reminder",
  "job_status",
  "invoice_notification",
  "payment_confirmation",
  "review_request",
  "follow_up",
];

/**
 * Outbound lifecycle: prepare → (approve) → queue → send → record result.
 * Phase 10 stops at `approved`/`queued`; nothing is transmitted.
 */
export type MessageStatus =
  | "received"
  | "draft"
  | "pending_approval"
  | "approved"
  | "queued"
  | "sent"
  | "delivered"
  | "failed"
  | "cancelled";

export const MESSAGE_STATUSES: MessageStatus[] = [
  "received",
  "draft",
  "pending_approval",
  "approved",
  "queued",
  "sent",
  "delivered",
  "failed",
  "cancelled",
];

export interface Message {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  channel: CommunicationChannel;
  type: MessageType;
  /** Plain-text body. No provider markup, no credentials. */
  body: string;
  status: MessageStatus;
  /** True when a human must approve before this may ever be sent. */
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: number;
  /** Why approval was required — audit trail for the future AI boundary. */
  approvalReason?: string;
  /** Business entities this message concerns. Ids only. */
  refs: EntityRef[];
  /** Phase 9 connection that will carry / carried this message. */
  integrationId?: string;
  /** Provider message id, recorded after a real send. Opaque. */
  externalMessageId?: string;
  /** Caller-supplied dedupe key. Unique per conversation. */
  idempotencyKey?: string;
  failureReason?: string;
  createdAt: number;
  updatedAt: number;
  sentAt?: number;
  createdBy: string;
}

export interface InboundMessageInput {
  conversationId: string;
  channel?: CommunicationChannel;
  type?: MessageType;
  body: string;
  refs?: EntityRef[];
  integrationId?: string;
  externalMessageId?: string;
  idempotencyKey?: string;
  receivedAt?: number;
}

export interface OutboundMessageInput {
  conversationId: string;
  channel?: CommunicationChannel;
  type?: MessageType;
  body: string;
  refs?: EntityRef[];
  integrationId?: string;
  idempotencyKey?: string;
  /** Force the human-approval gate even for a routine type. */
  requireApproval?: boolean;
  approvalReason?: string;
}

export interface InternalNoteInput {
  conversationId: string;
  body: string;
  refs?: EntityRef[];
}

export interface SendResultInput {
  /** Provider message id from the adapter. */
  externalMessageId?: string;
  sentAt?: number;
  /** Safe, non-secret failure text. */
  failureReason?: string;
}

export interface MessageListQuery {
  conversationId?: string;
  direction?: MessageDirection;
  status?: MessageStatus;
  type?: MessageType;
  requiresApprovalOnly?: boolean;
  limit?: number;
}

// ---- Service request (intake) ------------------------------------------

export type UrgencyLevel = "low" | "normal" | "high" | "emergency";

export const URGENCY_LEVELS: UrgencyLevel[] = [
  "low",
  "normal",
  "high",
  "emergency",
];

export type QualificationStatus =
  | "new"
  | "needs_info"
  | "qualified"
  | "disqualified"
  | "converted";

export const QUALIFICATION_STATUSES: QualificationStatus[] = [
  "new",
  "needs_info",
  "qualified",
  "disqualified",
  "converted",
];

/**
 * Structured intake captured from an inquiry. It is NOT a lead generator
 * and NOT a second customer record — `customerId` points at CRM once known.
 */
export interface ServiceRequest {
  id: string;
  conversationId?: string;
  customerId?: string;
  vehicleId?: string;
  /** Free text when the vehicle is not yet a CRM/Vehicles record. */
  vehicleDescription?: string;
  requestedService: string;
  problemDescription?: string;
  location?: string;
  /** Human-entered preference, e.g. "weekday mornings". Not a schedule. */
  preferredTiming?: string;
  urgency: UrgencyLevel;
  channel: CommunicationChannel;
  source?: string;
  qualificationStatus: QualificationStatus;
  /** Field names still needed before this can be quoted. */
  missingInformation: string[];
  /** Set when the request became real work. Ids only. */
  quoteId?: string;
  jobId?: string;
  appointmentId?: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface ServiceRequestCreateInput {
  conversationId?: string;
  customerId?: string;
  vehicleId?: string;
  vehicleDescription?: string;
  requestedService: string;
  problemDescription?: string;
  location?: string;
  preferredTiming?: string;
  urgency?: UrgencyLevel;
  channel: CommunicationChannel;
  source?: string;
  missingInformation?: string[];
}

export interface ServiceRequestUpdateInput {
  customerId?: string | null;
  vehicleId?: string | null;
  vehicleDescription?: string | null;
  requestedService?: string;
  problemDescription?: string | null;
  location?: string | null;
  preferredTiming?: string | null;
  urgency?: UrgencyLevel;
  qualificationStatus?: QualificationStatus;
  missingInformation?: string[];
  quoteId?: string | null;
  jobId?: string | null;
  appointmentId?: string | null;
}

export interface ServiceRequestListQuery {
  customerId?: string;
  conversationId?: string;
  qualificationStatus?: QualificationStatus;
  channel?: CommunicationChannel;
  limit?: number;
}

// ---- Review request -----------------------------------------------------

export type ReviewRequestStatus =
  | "eligible"
  | "prepared"
  | "sent"
  | "completed"
  | "suppressed";

export const REVIEW_REQUEST_STATUSES: ReviewRequestStatus[] = [
  "eligible",
  "prepared",
  "sent",
  "completed",
  "suppressed",
];

/**
 * A record that a customer BECAME eligible for a review ask. Phase 10 never
 * sends one. `dedupeKey` guarantees the same customer/job is never asked
 * twice, which is the entire point of storing it now.
 */
export interface ReviewRequest {
  id: string;
  customerId: string;
  jobId?: string;
  invoiceId?: string;
  conversationId?: string;
  status: ReviewRequestStatus;
  /** Stable natural key: `${customerId}:${jobId ?? "none"}`. Unique. */
  dedupeKey: string;
  createdAt: number;
  updatedAt: number;
  sentAt?: number;
}

export interface ReviewRequestCreateInput {
  customerId: string;
  jobId?: string;
  invoiceId?: string;
  conversationId?: string;
}

// ---- Customer context (read model) -------------------------------------

/**
 * A read-only projection assembled from THIS module's records plus opaque
 * ids. It intentionally holds no CRM/Finance field values — consumers
 * resolve those through the owning repositories.
 */
export interface CustomerCommunicationContext {
  customerId: string;
  conversationCount: number;
  openConversationIds: string[];
  awaitingSkildConversationIds: string[];
  awaitingCustomerConversationIds: string[];
  lastInboundAt?: number;
  lastOutboundAt?: number;
  /** Distinct business entities mentioned across every thread. */
  referencedEntities: EntityRef[];
  serviceRequestIds: string[];
  reviewRequestIds: string[];
}
