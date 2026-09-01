// Communication repository — public interface only.
//
// The concrete local implementation lives in ./local-repository.ts and is
// registered at bootstrap under COMMUNICATION_REPOSITORY. Consumers (route
// components, hooks, other modules, future automation) import ONLY from
// this file, so the implementation can later become server-backed or
// sync-backed without touching a single consumer.

import type {
  Conversation,
  ConversationCreateInput,
  ConversationListQuery,
  ConversationStatus,
  ConversationUpdateInput,
  CustomerCommunicationContext,
  EntityRef,
  InboundMessageInput,
  InternalNoteInput,
  Message,
  MessageListQuery,
  OutboundMessageInput,
  ReviewRequest,
  ReviewRequestCreateInput,
  ReviewRequestStatus,
  SendResultInput,
  ServiceRequest,
  ServiceRequestCreateInput,
  ServiceRequestListQuery,
  ServiceRequestUpdateInput,
} from "./schemas";

export const COMMUNICATION_REPOSITORY = "communication.repository";

export interface CommunicationRepository {
  // ---- Conversations ----------------------------------------------------
  listConversations(query?: ConversationListQuery): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | undefined>;
  /**
   * Returns the existing conversation for an external thread id when one is
   * already recorded — the idempotency entry point for inbound adapters.
   */
  findConversationByExternalThread(
    integrationId: string,
    externalThreadId: string,
  ): Promise<Conversation | undefined>;
  createConversation(input: ConversationCreateInput): Promise<Conversation>;
  updateConversation(
    id: string,
    patch: ConversationUpdateInput,
  ): Promise<Conversation>;
  setConversationStatus(
    id: string,
    status: ConversationStatus,
  ): Promise<Conversation>;
  /** Attach a business entity reference. Idempotent per (type, id). */
  linkEntity(conversationId: string, ref: EntityRef): Promise<Conversation>;
  unlinkEntity(conversationId: string, ref: EntityRef): Promise<Conversation>;

  // ---- Messages ---------------------------------------------------------
  listMessages(query?: MessageListQuery): Promise<Message[]>;
  getMessage(id: string): Promise<Message | undefined>;
  /** Record something the customer sent us. Never transmits anything. */
  recordInboundMessage(input: InboundMessageInput): Promise<Message>;
  /** Internal-only note on a thread. Never customer-visible. */
  addInternalNote(input: InternalNoteInput): Promise<Message>;
  /**
   * Prepare an outbound message. It is persisted as `draft` or
   * `pending_approval` — Phase 10 NEVER sends. Transmission is a future
   * integration-adapter concern.
   */
  prepareOutboundMessage(input: OutboundMessageInput): Promise<Message>;
  approveMessage(id: string, note?: string): Promise<Message>;
  /** Hand an approved message to the send pipeline. Still no transmission. */
  queueMessage(id: string): Promise<Message>;
  /** Record the outcome reported by an adapter after a real send. */
  recordSendResult(id: string, result: SendResultInput): Promise<Message>;
  cancelMessage(id: string, reason?: string): Promise<Message>;
  /** Idempotency lookup for retrying adapters. */
  findMessageByIdempotencyKey(
    conversationId: string,
    idempotencyKey: string,
  ): Promise<Message | undefined>;
  findMessageByExternalId(
    externalMessageId: string,
  ): Promise<Message | undefined>;

  // ---- Service requests (intake) ---------------------------------------
  listServiceRequests(
    query?: ServiceRequestListQuery,
  ): Promise<ServiceRequest[]>;
  getServiceRequest(id: string): Promise<ServiceRequest | undefined>;
  createServiceRequest(
    input: ServiceRequestCreateInput,
  ): Promise<ServiceRequest>;
  updateServiceRequest(
    id: string,
    patch: ServiceRequestUpdateInput,
  ): Promise<ServiceRequest>;

  // ---- Review requests --------------------------------------------------
  listReviewRequests(customerId?: string): Promise<ReviewRequest[]>;
  /** Deduplicated: the same (customer, job) pair yields the same record. */
  createReviewRequest(
    input: ReviewRequestCreateInput,
  ): Promise<ReviewRequest>;
  setReviewRequestStatus(
    id: string,
    status: ReviewRequestStatus,
  ): Promise<ReviewRequest>;

  // ---- Read models ------------------------------------------------------
  getCustomerContext(
    customerId: string,
  ): Promise<CustomerCommunicationContext>;

  /** Subscribe to any change; consumers use this to refresh. */
  subscribe(listener: () => void): () => void;
}
