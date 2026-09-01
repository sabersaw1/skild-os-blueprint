// Local in-memory + localStorage implementation of CommunicationRepository.
// Repository implementations are the ONLY place allowed to touch storage.
//
// Storage keys (versioned envelopes — see ./storage.ts):
//   skildos.communication.conversations.v1
//   skildos.communication.messages.v1
//   skildos.communication.serviceRequests.v1
//   skildos.communication.reviewRequests.v1
//
// Mutation ordering rule: validate → persist → emit → return.
// A validation failure must leave storage untouched and emit NO event.
//
// PHASE 10 BOUNDARY: nothing here transmits anything. `prepareOutboundMessage`
// / `approveMessage` / `queueMessage` only move a durable record along a
// lifecycle; `recordSendResult` exists so a future adapter can report back.

import { newId } from "@/core/ids";
import { getIdentity } from "@/core/auth/identity";
import { emit } from "@/core/activity/emitter";
import { getRepository, hasRepository } from "@/core/data/registry";
import { COMMUNICATION_EVENTS } from "../activity";
import { APPROVAL_REQUIRED_MESSAGE_TYPES } from "../capabilities";
import {
  CLOSED_CONVERSATION_STATUSES,
  COMMUNICATION_CHANNELS,
  CONVERSATION_STATUSES,
  ENTITY_REF_TYPES,
  MESSAGE_TYPES,
  QUALIFICATION_STATUSES,
  REVIEW_REQUEST_STATUSES,
  URGENCY_LEVELS,
  type AwaitingParty,
  type CommunicationChannel,
  type Conversation,
  type ConversationCreateInput,
  type ConversationListQuery,
  type ConversationStatus,
  type ConversationUpdateInput,
  type CustomerCommunicationContext,
  type EntityRef,
  type InboundMessageInput,
  type InternalNoteInput,
  type Message,
  type MessageListQuery,
  type MessageType,
  type OutboundMessageInput,
  type ReviewRequest,
  type ReviewRequestCreateInput,
  type ReviewRequestStatus,
  type SendResultInput,
  type ServiceRequest,
  type ServiceRequestCreateInput,
  type ServiceRequestListQuery,
  type ServiceRequestUpdateInput,
} from "./schemas";
import type { CommunicationRepository } from "./repository";
import { readEnvelope, registerVersionedKey } from "./storage";
import { commitRecords } from "@/core/storage/persistence";
import { withCapabilityEnforcement } from "@/core/auth/authorize";

const K_CONVERSATIONS = "skildos.communication.conversations.v1";
const K_MESSAGES = "skildos.communication.messages.v1";
const K_SERVICE_REQUESTS = "skildos.communication.serviceRequests.v1";
const K_REVIEW_REQUESTS = "skildos.communication.reviewRequests.v1";

registerVersionedKey<Conversation>({
  key: K_CONVERSATIONS,
  currentVersion: 1,
  // v0 (bare array, pre-envelope) had no `refs`; backfill so readers never
  // hit undefined. Future shape changes append a new migration here.
  migrations: {
    0: (records) =>
      (records as Conversation[]).map((c) => ({ ...c, refs: c.refs ?? [] })),
  },
});
registerVersionedKey<Message>({
  key: K_MESSAGES,
  currentVersion: 1,
  migrations: {
    0: (records) =>
      (records as Message[]).map((m) => ({
        ...m,
        refs: m.refs ?? [],
        requiresApproval: m.requiresApproval ?? false,
      })),
  },
});
registerVersionedKey<ServiceRequest>({
  key: K_SERVICE_REQUESTS,
  currentVersion: 1,
  migrations: {
    0: (records) =>
      (records as ServiceRequest[]).map((r) => ({
        ...r,
        missingInformation: r.missingInformation ?? [],
      })),
  },
});
registerVersionedKey<ReviewRequest>({
  key: K_REVIEW_REQUESTS,
  currentVersion: 1,
  migrations: { 0: (records) => records as ReviewRequest[] },
});

// ---- Cross-module reference checks -------------------------------------
// Communication never imports another module. It resolves sibling
// repositories through the Data Registry and only validates when one is
// registered — so the module stays usable standalone (and in isolated tests).

const REF_REPOSITORIES: Partial<
  Record<EntityRef["type"], { key: string; method: string }>
> = {
  customer: { key: "crm.customerRepository", method: "get" },
  vehicle: { key: "vehicles.vehicleRepository", method: "get" },
  inspection: { key: "inspections.repository", method: "getInspection" },
  quote: { key: "quotes.repository", method: "getQuote" },
  job: { key: "jobs.repository", method: "getJob" },
  invoice: { key: "finance.repository", method: "getInvoice" },
  // appointment / payment / service_request / review_request have no
  // registered owner repository yet — references stay opaque and unchecked.
};

async function refExists(type: EntityRef["type"], id: string): Promise<boolean> {
  const target = REF_REPOSITORIES[type];
  if (!target || !id) return true;
  if (!hasRepository(target.key)) return true;
  try {
    const repo = getRepository<Record<string, (i: string) => Promise<unknown>>>(
      target.key,
    );
    const fn = repo[target.method];
    if (typeof fn !== "function") return true;
    return Boolean(await fn.call(repo, id));
  } catch {
    return true;
  }
}

async function assertRef(ref: EntityRef): Promise<void> {
  if (!ENTITY_REF_TYPES.includes(ref.type)) {
    throw new Error(`Invalid entity reference type "${ref.type}".`);
  }
  if (!ref.id?.trim()) throw new Error(`Entity reference "${ref.type}" needs an id.`);
  if (!(await refExists(ref.type, ref.id))) {
    throw new Error(`Unknown ${ref.type} "${ref.id}".`);
  }
}

async function assertRefs(refs: EntityRef[] | undefined): Promise<EntityRef[]> {
  const list = refs ?? [];
  for (const ref of list) await assertRef(ref);
  return dedupeRefs(list);
}

function dedupeRefs(refs: EntityRef[]): EntityRef[] {
  const seen = new Set<string>();
  const out: EntityRef[] = [];
  for (const r of refs) {
    const k = `${r.type}:${r.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ type: r.type, id: r.id });
  }
  return out;
}

// ---- Validation ---------------------------------------------------------

function trimmed(v?: string | null): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

function assertChannel(channel: CommunicationChannel): void {
  if (!COMMUNICATION_CHANNELS.includes(channel)) {
    throw new Error(`Invalid channel "${channel}".`);
  }
}

function assertBody(body: string | undefined): string {
  const t = body?.trim();
  if (!t) throw new Error("Message body is required.");
  if (t.length > 20000) throw new Error("Message body is too long.");
  return t;
}

function awaitingFor(status: ConversationStatus): AwaitingParty {
  if (status === "awaiting_customer") return "customer";
  if (status === "awaiting_skild") return "skild";
  return "none";
}

function assertOpenThread(c: Conversation, action: string): void {
  if (CLOSED_CONVERSATION_STATUSES.includes(c.status)) {
    throw new Error(
      `Conversation is ${c.status}; reopen it before ${action}.`,
    );
  }
}

function requiresApprovalFor(type: MessageType, forced?: boolean): boolean {
  if (forced) return true;
  return (APPROVAL_REQUIRED_MESSAGE_TYPES as readonly string[]).includes(type);
}

// ---- Implementation -----------------------------------------------------

export function createLocalCommunicationRepository(): CommunicationRepository {
  let conversations: Conversation[] =
    readEnvelope<Conversation>(K_CONVERSATIONS) ?? [];
  let messages: Message[] = readEnvelope<Message>(K_MESSAGES) ?? [];
  let serviceRequests: ServiceRequest[] =
    readEnvelope<ServiceRequest>(K_SERVICE_REQUESTS) ?? [];
  let reviewRequests: ReviewRequest[] =
    readEnvelope<ReviewRequest>(K_REVIEW_REQUESTS) ?? [];

  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  // Persistence commit: in-memory state advances ONLY on a durable write.
  // A failure throws PersistenceError before any emit() runs.
  const persistConversations = (next: Conversation[]) => {
    conversations = commitRecords(K_CONVERSATIONS, next);
  };
  const persistMessages = (next: Message[]) => {
    messages = commitRecords(K_MESSAGES, next);
  };
  const persistServiceRequests = (next: ServiceRequest[]) => {
    serviceRequests = commitRecords(K_SERVICE_REQUESTS, next);
  };
  const persistReviewRequests = (next: ReviewRequest[]) => {
    reviewRequests = commitRecords(K_REVIEW_REQUESTS, next);
  };

  const requireConversation = (id: string): Conversation => {
    const found = conversations.find((c) => c.id === id);
    if (!found) throw new Error(`Unknown conversation "${id}".`);
    return found;
  };

  const requireMessage = (id: string): Message => {
    const found = messages.find((m) => m.id === id);
    if (!found) throw new Error(`Unknown message "${id}".`);
    return found;
  };

  const replaceConversation = (next: Conversation) => {
    persistConversations(
      conversations.map((c) => (c.id === next.id ? next : c)),
    );
  };

  const replaceMessage = (next: Message) => {
    persistMessages(messages.map((m) => (m.id === next.id ? next : m)));
  };

  /** Roll thread activity forward after a message lands. */
  const touchConversation = (
    conversationId: string,
    at: number,
    patch: Partial<Conversation>,
  ) => {
    const existing = requireConversation(conversationId);
    replaceConversation({
      ...existing,
      ...patch,
      lastMessageAt: at,
      updatedAt: at,
    });
  };

  const impl: CommunicationRepository = {
    // ---- Conversations --------------------------------------------------
    async listConversations(query?: ConversationListQuery) {
      const q = query ?? {};
      const needle = q.search?.trim().toLowerCase();
      let items = conversations.filter((c) => {
        if (q.customerId && c.customerId !== q.customerId) return false;
        if (q.vehicleId && c.vehicleId !== q.vehicleId) return false;
        if (q.channel && c.channel !== q.channel) return false;
        if (q.status && c.status !== q.status) return false;
        if (q.awaitingParty && c.awaitingParty !== q.awaitingParty) return false;
        if (
          q.ref &&
          !c.refs.some((r) => r.type === q.ref!.type && r.id === q.ref!.id)
        ) {
          return false;
        }
        if (q.inactiveSince !== undefined) {
          const last = c.lastMessageAt ?? c.createdAt;
          if (last > q.inactiveSince) return false;
        }
        if (needle) {
          const hay = [c.subject, c.source, ...(c.tags ?? [])]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      });
      items = items.sort(
        (a, b) =>
          (b.lastMessageAt ?? b.createdAt) - (a.lastMessageAt ?? a.createdAt),
      );
      return q.limit ? items.slice(0, q.limit) : items;
    },

    async getConversation(id) {
      return conversations.find((c) => c.id === id);
    },

    async findConversationByExternalThread(integrationId, externalThreadId) {
      if (!integrationId || !externalThreadId) return undefined;
      return conversations.find(
        (c) =>
          c.integrationId === integrationId &&
          c.externalThreadId === externalThreadId,
      );
    },

    async createConversation(input: ConversationCreateInput) {
      if (!input.customerId?.trim()) throw new Error("customerId is required.");
      assertChannel(input.channel);
      if (input.status && !CONVERSATION_STATUSES.includes(input.status)) {
        throw new Error(`Invalid conversation status "${input.status}".`);
      }
      await assertRef({ type: "customer", id: input.customerId.trim() });
      const vehicleId = trimmed(input.vehicleId);
      if (vehicleId) await assertRef({ type: "vehicle", id: vehicleId });
      const refs = await assertRefs(input.refs);

      // Idempotency: an adapter replaying the same provider thread must not
      // create a second conversation.
      const integrationId = trimmed(input.integrationId);
      const externalThreadId = trimmed(input.externalThreadId);
      if (integrationId && externalThreadId) {
        const existing = conversations.find(
          (c) =>
            c.integrationId === integrationId &&
            c.externalThreadId === externalThreadId,
        );
        if (existing) return existing;
      }

      const now = Date.now();
      const status = input.status ?? "open";
      const conversation: Conversation = {
        id: newId(),
        customerId: input.customerId.trim(),
        vehicleId,
        channel: input.channel,
        status,
        awaitingParty: awaitingFor(status),
        subject: trimmed(input.subject),
        source: trimmed(input.source),
        integrationId,
        externalThreadId,
        refs,
        tags: input.tags?.map((t) => t.trim()).filter(Boolean),
        createdAt: now,
        updatedAt: now,
        createdBy: getIdentity().id,
      };

      persistConversations([conversation, ...conversations]);
      emit({
        type: COMMUNICATION_EVENTS.conversationCreated,
        moduleId: "communication",
        summary: `Conversation opened (${conversation.channel})`,
        payload: {
          conversationId: conversation.id,
          customerId: conversation.customerId,
          channel: conversation.channel,
        },
      });
      notify();
      return conversation;
    },

    async updateConversation(id, patch: ConversationUpdateInput) {
      const existing = requireConversation(id);
      const vehicleId =
        patch.vehicleId === null
          ? undefined
          : patch.vehicleId !== undefined
            ? trimmed(patch.vehicleId)
            : existing.vehicleId;
      if (vehicleId && vehicleId !== existing.vehicleId) {
        await assertRef({ type: "vehicle", id: vehicleId });
      }
      const refs = patch.refs ? await assertRefs(patch.refs) : existing.refs;

      const changed: string[] = [];
      if (vehicleId !== existing.vehicleId) changed.push("vehicleId");
      if (patch.subject !== undefined) changed.push("subject");
      if (patch.source !== undefined) changed.push("source");
      if (patch.tags !== undefined) changed.push("tags");
      if (patch.refs !== undefined) changed.push("refs");

      const next: Conversation = {
        ...existing,
        vehicleId,
        subject:
          patch.subject === null
            ? undefined
            : patch.subject !== undefined
              ? trimmed(patch.subject)
              : existing.subject,
        source:
          patch.source === null
            ? undefined
            : patch.source !== undefined
              ? trimmed(patch.source)
              : existing.source,
        tags: patch.tags ?? existing.tags,
        refs,
        updatedAt: Date.now(),
      };

      replaceConversation(next);
      emit({
        type: COMMUNICATION_EVENTS.conversationUpdated,
        moduleId: "communication",
        summary: `Conversation updated (${changed.join(", ") || "no fields"})`,
        payload: { conversationId: next.id, changedFields: changed },
      });
      notify();
      return next;
    },

    async setConversationStatus(id, status) {
      const existing = requireConversation(id);
      if (!CONVERSATION_STATUSES.includes(status)) {
        throw new Error(`Invalid conversation status "${status}".`);
      }
      if (existing.status === status) return existing;

      const next: Conversation = {
        ...existing,
        status,
        awaitingParty: awaitingFor(status),
        updatedAt: Date.now(),
      };
      replaceConversation(next);
      emit({
        type: COMMUNICATION_EVENTS.conversationStatusChanged,
        moduleId: "communication",
        summary: `Conversation ${existing.status} → ${status}`,
        payload: {
          conversationId: next.id,
          fromStatus: existing.status,
          toStatus: status,
          awaitingParty: next.awaitingParty,
        },
      });
      notify();
      return next;
    },

    async linkEntity(conversationId, ref) {
      const existing = requireConversation(conversationId);
      await assertRef(ref);
      if (existing.refs.some((r) => r.type === ref.type && r.id === ref.id)) {
        return existing;
      }
      const next: Conversation = {
        ...existing,
        refs: [...existing.refs, { type: ref.type, id: ref.id }],
        updatedAt: Date.now(),
      };
      replaceConversation(next);
      emit({
        type: COMMUNICATION_EVENTS.conversationLinked,
        moduleId: "communication",
        summary: `Conversation linked to ${ref.type}`,
        payload: {
          conversationId: next.id,
          refType: ref.type,
          refId: ref.id,
        },
      });
      notify();
      return next;
    },

    async unlinkEntity(conversationId, ref) {
      const existing = requireConversation(conversationId);
      const refs = existing.refs.filter(
        (r) => !(r.type === ref.type && r.id === ref.id),
      );
      if (refs.length === existing.refs.length) return existing;
      const next: Conversation = { ...existing, refs, updatedAt: Date.now() };
      replaceConversation(next);
      emit({
        type: COMMUNICATION_EVENTS.conversationUpdated,
        moduleId: "communication",
        summary: `Conversation unlinked from ${ref.type}`,
        payload: { conversationId: next.id, changedFields: ["refs"] },
      });
      notify();
      return next;
    },

    // ---- Messages -------------------------------------------------------
    async listMessages(query?: MessageListQuery) {
      const q = query ?? {};
      let items = messages.filter((m) => {
        if (q.conversationId && m.conversationId !== q.conversationId) return false;
        if (q.direction && m.direction !== q.direction) return false;
        if (q.status && m.status !== q.status) return false;
        if (q.type && m.type !== q.type) return false;
        if (q.requiresApprovalOnly && !(m.requiresApproval && !m.approvedAt)) {
          return false;
        }
        return true;
      });
      items = items.sort((a, b) => a.createdAt - b.createdAt);
      return q.limit ? items.slice(-q.limit) : items;
    },

    async getMessage(id) {
      return messages.find((m) => m.id === id);
    },

    async findMessageByIdempotencyKey(conversationId, idempotencyKey) {
      if (!idempotencyKey) return undefined;
      return messages.find(
        (m) =>
          m.conversationId === conversationId &&
          m.idempotencyKey === idempotencyKey,
      );
    },

    async findMessageByExternalId(externalMessageId) {
      if (!externalMessageId) return undefined;
      return messages.find((m) => m.externalMessageId === externalMessageId);
    },

    async recordInboundMessage(input: InboundMessageInput) {
      const conversation = requireConversation(input.conversationId);
      const body = assertBody(input.body);
      const type = input.type ?? "general";
      if (!MESSAGE_TYPES.includes(type)) {
        throw new Error(`Invalid message type "${type}".`);
      }
      const channel = input.channel ?? conversation.channel;
      assertChannel(channel);
      const refs = await assertRefs(input.refs);

      // Idempotency: a retrying adapter must not duplicate the message.
      const idempotencyKey = trimmed(input.idempotencyKey);
      const externalMessageId = trimmed(input.externalMessageId);
      const duplicate = messages.find(
        (m) =>
          (idempotencyKey &&
            m.conversationId === conversation.id &&
            m.idempotencyKey === idempotencyKey) ||
          (externalMessageId && m.externalMessageId === externalMessageId),
      );
      if (duplicate) return duplicate;

      const at = input.receivedAt ?? Date.now();
      const message: Message = {
        id: newId(),
        conversationId: conversation.id,
        direction: "inbound",
        channel,
        type,
        body,
        status: "received",
        requiresApproval: false,
        refs,
        integrationId: trimmed(input.integrationId) ?? conversation.integrationId,
        externalMessageId,
        idempotencyKey,
        createdAt: at,
        updatedAt: at,
        createdBy: getIdentity().id,
      };

      persistMessages([...messages, message]);
      // An inbound message means the ball is in Skild's court.
      touchConversation(conversation.id, at, {
        status: CLOSED_CONVERSATION_STATUSES.includes(conversation.status)
          ? conversation.status
          : "awaiting_skild",
        awaitingParty: CLOSED_CONVERSATION_STATUSES.includes(conversation.status)
          ? conversation.awaitingParty
          : "skild",
        lastCustomerMessageAt: at,
      });
      emit({
        type: COMMUNICATION_EVENTS.messageReceived,
        moduleId: "communication",
        summary: `Inbound ${channel} message received`,
        payload: {
          messageId: message.id,
          conversationId: conversation.id,
          customerId: conversation.customerId,
          channel,
          messageType: type,
        },
      });
      notify();
      return message;
    },

    async addInternalNote(input: InternalNoteInput) {
      const conversation = requireConversation(input.conversationId);
      const body = assertBody(input.body);
      const refs = await assertRefs(input.refs);

      const at = Date.now();
      const message: Message = {
        id: newId(),
        conversationId: conversation.id,
        direction: "internal",
        channel: conversation.channel,
        type: "internal_note",
        body,
        status: "received",
        requiresApproval: false,
        refs,
        createdAt: at,
        updatedAt: at,
        createdBy: getIdentity().id,
      };

      persistMessages([...messages, message]);
      // Internal notes never change who we're waiting on.
      replaceConversation({ ...conversation, updatedAt: at });
      emit({
        type: COMMUNICATION_EVENTS.noteAdded,
        moduleId: "communication",
        summary: "Internal note added to conversation",
        payload: { messageId: message.id, conversationId: conversation.id },
      });
      notify();
      return message;
    },

    async prepareOutboundMessage(input: OutboundMessageInput) {
      const conversation = requireConversation(input.conversationId);
      assertOpenThread(conversation, "preparing a reply");
      const body = assertBody(input.body);
      const type = input.type ?? "general";
      if (!MESSAGE_TYPES.includes(type)) {
        throw new Error(`Invalid message type "${type}".`);
      }
      if (type === "internal_note") {
        throw new Error("Use addInternalNote for internal notes.");
      }
      const channel = input.channel ?? conversation.channel;
      assertChannel(channel);
      const refs = await assertRefs(input.refs);

      const idempotencyKey = trimmed(input.idempotencyKey);
      if (idempotencyKey) {
        const duplicate = messages.find(
          (m) =>
            m.conversationId === conversation.id &&
            m.idempotencyKey === idempotencyKey,
        );
        if (duplicate) return duplicate;
      }

      const requiresApproval = requiresApprovalFor(type, input.requireApproval);
      const at = Date.now();
      const message: Message = {
        id: newId(),
        conversationId: conversation.id,
        direction: "outbound",
        channel,
        type,
        body,
        status: requiresApproval ? "pending_approval" : "draft",
        requiresApproval,
        approvalReason: requiresApproval
          ? (trimmed(input.approvalReason) ??
            `Message type "${type}" requires human approval.`)
          : undefined,
        refs,
        integrationId: trimmed(input.integrationId) ?? conversation.integrationId,
        idempotencyKey,
        createdAt: at,
        updatedAt: at,
        createdBy: getIdentity().id,
      };

      persistMessages([...messages, message]);
      replaceConversation({ ...conversation, updatedAt: at });
      emit({
        type: COMMUNICATION_EVENTS.messagePrepared,
        moduleId: "communication",
        summary: `Outbound ${type} prepared (${message.status})`,
        payload: {
          messageId: message.id,
          conversationId: conversation.id,
          customerId: conversation.customerId,
          channel,
          messageType: type,
          requiresApproval,
        },
      });
      notify();
      return message;
    },

    async approveMessage(id, note?: string) {
      const existing = requireMessage(id);
      if (existing.direction !== "outbound") {
        throw new Error("Only outbound messages can be approved.");
      }
      if (existing.status !== "pending_approval" && existing.status !== "draft") {
        throw new Error(
          `Message is ${existing.status} and can no longer be approved.`,
        );
      }
      const identity = getIdentity();
      const next: Message = {
        ...existing,
        status: "approved",
        approvedBy: identity.id,
        approvedAt: Date.now(),
        approvalReason: trimmed(note) ?? existing.approvalReason,
        updatedAt: Date.now(),
      };
      replaceMessage(next);
      emit({
        type: COMMUNICATION_EVENTS.messageApproved,
        moduleId: "communication",
        summary: `Outbound ${next.type} approved`,
        payload: {
          messageId: next.id,
          conversationId: next.conversationId,
          approvedBy: identity.id,
          messageType: next.type,
        },
      });
      notify();
      return next;
    },

    async queueMessage(id) {
      const existing = requireMessage(id);
      if (existing.direction !== "outbound") {
        throw new Error("Only outbound messages can be queued.");
      }
      // AUTHORITATIVE APPROVAL GATE (Phase 12.2).
      // The requirement is re-derived from the message TYPE, not read from
      // the stored `requiresApproval` flag — a caller that persisted the
      // record with the flag cleared (or a legacy/migrated row) must still
      // be stopped here. The UI check is advisory; this one is the boundary.
      const mustBeApproved =
        existing.requiresApproval ||
        requiresApprovalFor(existing.type as MessageType);
      if (mustBeApproved && existing.status !== "approved") {
        throw new Error(
          "This message requires human approval before it can be queued.",
        );
      }
      if (!["draft", "approved"].includes(existing.status)) {
        throw new Error(`Message is ${existing.status} and cannot be queued.`);
      }
      const next: Message = {
        ...existing,
        status: "queued",
        updatedAt: Date.now(),
      };
      replaceMessage(next);
      emit({
        type: COMMUNICATION_EVENTS.messageQueued,
        moduleId: "communication",
        summary: `Outbound ${next.type} queued for delivery`,
        payload: {
          messageId: next.id,
          conversationId: next.conversationId,
          channel: next.channel,
          messageType: next.type,
          integrationId: next.integrationId,
        },
      });
      notify();
      return next;
    },

    async recordSendResult(id, result: SendResultInput) {
      const existing = requireMessage(id);
      if (existing.direction !== "outbound") {
        throw new Error("Only outbound messages have send results.");
      }
      if (existing.status !== "queued" && existing.status !== "failed") {
        throw new Error(
          `Message is ${existing.status}; only queued or failed messages accept a send result.`,
        );
      }
      const failure = trimmed(result.failureReason);
      const at = result.sentAt ?? Date.now();
      const next: Message = {
        ...existing,
        status: failure ? "failed" : "sent",
        externalMessageId: failure
          ? existing.externalMessageId
          : (trimmed(result.externalMessageId) ?? existing.externalMessageId),
        sentAt: failure ? existing.sentAt : at,
        failureReason: failure,
        updatedAt: Date.now(),
      };
      replaceMessage(next);

      if (!failure) {
        const conversation = requireConversation(next.conversationId);
        if (!CLOSED_CONVERSATION_STATUSES.includes(conversation.status)) {
          touchConversation(next.conversationId, at, {
            status: "awaiting_customer",
            awaitingParty: "customer",
            lastOutboundMessageAt: at,
          });
        }
      }

      emit({
        type: failure
          ? COMMUNICATION_EVENTS.messageFailed
          : COMMUNICATION_EVENTS.messageSent,
        moduleId: "communication",
        summary: failure
          ? `Outbound ${next.type} failed`
          : `Outbound ${next.type} sent`,
        payload: {
          messageId: next.id,
          conversationId: next.conversationId,
          channel: next.channel,
          messageType: next.type,
          integrationId: next.integrationId,
          ...(failure ? { reason: failure } : {}),
        },
      });
      notify();
      return next;
    },

    async cancelMessage(id, reason?: string) {
      const existing = requireMessage(id);
      if (existing.direction !== "outbound") {
        throw new Error("Only outbound messages can be cancelled.");
      }
      if (existing.status === "sent" || existing.status === "delivered") {
        throw new Error("A sent message cannot be cancelled.");
      }
      const next: Message = {
        ...existing,
        status: "cancelled",
        failureReason: trimmed(reason),
        updatedAt: Date.now(),
      };
      replaceMessage(next);
      emit({
        type: COMMUNICATION_EVENTS.messageCancelled,
        moduleId: "communication",
        summary: `Outbound ${next.type} cancelled`,
        payload: {
          messageId: next.id,
          conversationId: next.conversationId,
          messageType: next.type,
        },
      });
      notify();
      return next;
    },

    // ---- Service requests ------------------------------------------------
    async listServiceRequests(query?: ServiceRequestListQuery) {
      const q = query ?? {};
      const items = serviceRequests
        .filter((r) => {
          if (q.customerId && r.customerId !== q.customerId) return false;
          if (q.conversationId && r.conversationId !== q.conversationId) {
            return false;
          }
          if (
            q.qualificationStatus &&
            r.qualificationStatus !== q.qualificationStatus
          ) {
            return false;
          }
          if (q.channel && r.channel !== q.channel) return false;
          return true;
        })
        .sort((a, b) => b.createdAt - a.createdAt);
      return q.limit ? items.slice(0, q.limit) : items;
    },

    async getServiceRequest(id) {
      return serviceRequests.find((r) => r.id === id);
    },

    async createServiceRequest(input: ServiceRequestCreateInput) {
      const requestedService = input.requestedService?.trim();
      if (!requestedService) throw new Error("requestedService is required.");
      assertChannel(input.channel);
      const urgency = input.urgency ?? "normal";
      if (!URGENCY_LEVELS.includes(urgency)) {
        throw new Error(`Invalid urgency "${urgency}".`);
      }
      const customerId = trimmed(input.customerId);
      if (customerId) await assertRef({ type: "customer", id: customerId });
      const vehicleId = trimmed(input.vehicleId);
      if (vehicleId) await assertRef({ type: "vehicle", id: vehicleId });
      const conversationId = trimmed(input.conversationId);
      if (conversationId) requireConversation(conversationId);

      const missing = new Set(
        (input.missingInformation ?? []).map((m) => m.trim()).filter(Boolean),
      );
      if (!customerId) missing.add("customerId");
      if (!vehicleId && !trimmed(input.vehicleDescription)) missing.add("vehicle");

      const now = Date.now();
      const request: ServiceRequest = {
        id: newId(),
        conversationId,
        customerId,
        vehicleId,
        vehicleDescription: trimmed(input.vehicleDescription),
        requestedService,
        problemDescription: trimmed(input.problemDescription),
        location: trimmed(input.location),
        preferredTiming: trimmed(input.preferredTiming),
        urgency,
        channel: input.channel,
        source: trimmed(input.source),
        qualificationStatus: missing.size > 0 ? "needs_info" : "new",
        missingInformation: Array.from(missing),
        createdAt: now,
        updatedAt: now,
        createdBy: getIdentity().id,
      };

      persistServiceRequests([request, ...serviceRequests]);
      emit({
        type: COMMUNICATION_EVENTS.serviceRequestCreated,
        moduleId: "communication",
        summary: `Service request captured (${request.channel})`,
        payload: {
          serviceRequestId: request.id,
          conversationId: request.conversationId,
          customerId: request.customerId,
          channel: request.channel,
          urgency: request.urgency,
          missingCount: request.missingInformation.length,
        },
      });
      notify();
      return request;
    },

    async updateServiceRequest(id, patch: ServiceRequestUpdateInput) {
      const existing = serviceRequests.find((r) => r.id === id);
      if (!existing) throw new Error(`Unknown service request "${id}".`);

      if (
        patch.qualificationStatus &&
        !QUALIFICATION_STATUSES.includes(patch.qualificationStatus)
      ) {
        throw new Error(
          `Invalid qualification status "${patch.qualificationStatus}".`,
        );
      }
      if (patch.urgency && !URGENCY_LEVELS.includes(patch.urgency)) {
        throw new Error(`Invalid urgency "${patch.urgency}".`);
      }
      if (patch.requestedService !== undefined && !patch.requestedService.trim()) {
        throw new Error("requestedService cannot be empty.");
      }

      const nullable = <T>(
        value: T | null | undefined,
        current: T | undefined,
      ): T | undefined =>
        value === null ? undefined : value !== undefined ? value : current;

      const customerId = nullable(trimmed(patch.customerId), existing.customerId);
      if (customerId && customerId !== existing.customerId) {
        await assertRef({ type: "customer", id: customerId });
      }
      const vehicleId = nullable(trimmed(patch.vehicleId), existing.vehicleId);
      if (vehicleId && vehicleId !== existing.vehicleId) {
        await assertRef({ type: "vehicle", id: vehicleId });
      }
      const quoteId = nullable(trimmed(patch.quoteId), existing.quoteId);
      if (quoteId && quoteId !== existing.quoteId) {
        await assertRef({ type: "quote", id: quoteId });
      }
      const jobId = nullable(trimmed(patch.jobId), existing.jobId);
      if (jobId && jobId !== existing.jobId) {
        await assertRef({ type: "job", id: jobId });
      }

      const next: ServiceRequest = {
        ...existing,
        customerId,
        vehicleId,
        vehicleDescription: nullable(
          trimmed(patch.vehicleDescription),
          existing.vehicleDescription,
        ),
        requestedService:
          patch.requestedService?.trim() ?? existing.requestedService,
        problemDescription: nullable(
          trimmed(patch.problemDescription),
          existing.problemDescription,
        ),
        location: nullable(trimmed(patch.location), existing.location),
        preferredTiming: nullable(
          trimmed(patch.preferredTiming),
          existing.preferredTiming,
        ),
        urgency: patch.urgency ?? existing.urgency,
        qualificationStatus:
          patch.qualificationStatus ?? existing.qualificationStatus,
        missingInformation:
          patch.missingInformation?.map((m) => m.trim()).filter(Boolean) ??
          existing.missingInformation,
        quoteId,
        jobId,
        appointmentId: nullable(
          trimmed(patch.appointmentId),
          existing.appointmentId,
        ),
        updatedAt: Date.now(),
      };

      persistServiceRequests(
        serviceRequests.map((r) => (r.id === id ? next : r)),
      );

      const statusChanged =
        patch.qualificationStatus !== undefined &&
        patch.qualificationStatus !== existing.qualificationStatus;
      const eventType =
        statusChanged && next.qualificationStatus === "converted"
          ? COMMUNICATION_EVENTS.serviceRequestConverted
          : statusChanged && next.qualificationStatus === "qualified"
            ? COMMUNICATION_EVENTS.serviceRequestQualified
            : COMMUNICATION_EVENTS.serviceRequestUpdated;

      emit({
        type: eventType,
        moduleId: "communication",
        summary: `Service request ${next.qualificationStatus}`,
        payload: {
          serviceRequestId: next.id,
          qualificationStatus: next.qualificationStatus,
          quoteId: next.quoteId,
          jobId: next.jobId,
        },
      });
      notify();
      return next;
    },

    // ---- Review requests -------------------------------------------------
    async listReviewRequests(customerId?: string) {
      return reviewRequests
        .filter((r) => !customerId || r.customerId === customerId)
        .sort((a, b) => b.createdAt - a.createdAt);
    },

    async createReviewRequest(input: ReviewRequestCreateInput) {
      const customerId = input.customerId?.trim();
      if (!customerId) throw new Error("customerId is required.");
      await assertRef({ type: "customer", id: customerId });
      const jobId = trimmed(input.jobId);
      if (jobId) await assertRef({ type: "job", id: jobId });
      const invoiceId = trimmed(input.invoiceId);
      if (invoiceId) await assertRef({ type: "invoice", id: invoiceId });

      // Deduplication is the whole reason this record exists: the same
      // customer/job must never be asked twice.
      const dedupeKey = `${customerId}:${jobId ?? "none"}`;
      const existing = reviewRequests.find((r) => r.dedupeKey === dedupeKey);
      if (existing) return existing;

      const now = Date.now();
      const request: ReviewRequest = {
        id: newId(),
        customerId,
        jobId,
        invoiceId,
        conversationId: trimmed(input.conversationId),
        status: "eligible",
        dedupeKey,
        createdAt: now,
        updatedAt: now,
      };
      persistReviewRequests([request, ...reviewRequests]);
      emit({
        type: COMMUNICATION_EVENTS.reviewRequestCreated,
        moduleId: "communication",
        summary: "Customer became eligible for a review request",
        payload: {
          reviewRequestId: request.id,
          customerId: request.customerId,
          jobId: request.jobId,
        },
      });
      notify();
      return request;
    },

    async setReviewRequestStatus(id, status: ReviewRequestStatus) {
      const existing = reviewRequests.find((r) => r.id === id);
      if (!existing) throw new Error(`Unknown review request "${id}".`);
      if (!REVIEW_REQUEST_STATUSES.includes(status)) {
        throw new Error(`Invalid review request status "${status}".`);
      }
      const now = Date.now();
      const next: ReviewRequest = {
        ...existing,
        status,
        sentAt: status === "sent" ? now : existing.sentAt,
        updatedAt: now,
      };
      persistReviewRequests(
        reviewRequests.map((r) => (r.id === id ? next : r)),
      );
      emit({
        type: COMMUNICATION_EVENTS.reviewRequestUpdated,
        moduleId: "communication",
        summary: `Review request ${status}`,
        payload: { reviewRequestId: next.id, status },
      });
      notify();
      return next;
    },

    // ---- Read models -----------------------------------------------------
    async getCustomerContext(customerId): Promise<CustomerCommunicationContext> {
      const threads = conversations.filter((c) => c.customerId === customerId);
      const ids = new Set(threads.map((c) => c.id));
      const threadMessages = messages.filter((m) => ids.has(m.conversationId));

      const inbound = threadMessages.filter((m) => m.direction === "inbound");
      const outbound = threadMessages.filter(
        (m) => m.direction === "outbound" && m.sentAt !== undefined,
      );

      return {
        customerId,
        conversationCount: threads.length,
        openConversationIds: threads
          .filter((c) => !CLOSED_CONVERSATION_STATUSES.includes(c.status))
          .map((c) => c.id),
        awaitingSkildConversationIds: threads
          .filter((c) => c.awaitingParty === "skild")
          .map((c) => c.id),
        awaitingCustomerConversationIds: threads
          .filter((c) => c.awaitingParty === "customer")
          .map((c) => c.id),
        lastInboundAt: inbound.length
          ? Math.max(...inbound.map((m) => m.createdAt))
          : undefined,
        lastOutboundAt: outbound.length
          ? Math.max(...outbound.map((m) => m.sentAt!))
          : undefined,
        referencedEntities: dedupeRefs([
          ...threads.flatMap((c) => c.refs),
          ...threadMessages.flatMap((m) => m.refs),
        ]),
        serviceRequestIds: serviceRequests
          .filter((r) => r.customerId === customerId)
          .map((r) => r.id),
        reviewRequestIds: reviewRequests
          .filter((r) => r.customerId === customerId)
          .map((r) => r.id),
      };
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  // Authorization boundary — see src/core/auth/authorize.ts. Preparing,
  // approving, and releasing outbound communication are separate
  // capabilities on purpose: a future agent can be granted preparation
  // rights while remaining structurally unable to approve or release.
  return withCapabilityEnforcement(impl, {
    createConversation: "communication.write",
    updateConversation: "communication.write",
    setConversationStatus: "communication.write",
    linkEntity: "communication.write",
    unlinkEntity: "communication.write",
    recordInboundMessage: "communication.write",
    addInternalNote: "communication.write",
    prepareOutboundMessage: "communication.write",
    approveMessage: "communication.approve",
    queueMessage: "communication.send",
    recordSendResult: "communication.send",
    cancelMessage: "communication.write",
    createServiceRequest: "communication.write",
    updateServiceRequest: "communication.write",
    createReviewRequest: "communication.write",
    setReviewRequestStatus: "communication.write",
  });
}
