// Record-state observers (Phase 13).
//
// An observer READS. It never mutates anything, and it reaches every record
// through the owning module's PUBLIC repository contract via the Data
// Registry — never through a sibling module's local implementation, never
// through storage.
//
// An observation is SYSTEM-DERIVED information: "this lead has not been
// touched for 7 days" is a fact about our own records. The rationale an
// observer attaches ("worth a follow-up") is a SUGGESTION. Neither becomes
// business truth, and neither contacts anybody.

import { getRepository, hasRepository } from "@/core/data/registry";
import {
  MARKETING_REPOSITORY,
  type MarketingRepository,
} from "@/modules/marketing/data/repository";
import {
  QUOTES_REPOSITORY,
  type QuotesRepository,
} from "@/modules/quotes/data/repository";
import {
  COMMUNICATION_REPOSITORY,
  type CommunicationRepository,
} from "@/modules/communication/data/repository";
import type { AgentActionType, EntityRef } from "../data/schemas";

export const DAY_MS = 24 * 60 * 60 * 1000;

export interface Observation {
  observerId: string;
  actionType: AgentActionType;
  targets: EntityRef[];
  /** Suggestion, not truth. Carries no customer PII. */
  rationale: string;
  /** Scalar values a rule's conditions may be evaluated against. */
  values: Record<string, unknown>;
  /** Stable per-target part of the idempotency key. */
  subject: string;
}

export interface ObserverContext {
  now: number;
  staleAfterMs: number;
  limit: number;
}

export type Observer = (ctx: ObserverContext) => Promise<Observation[]>;

/** Stale leads — flags an internal attention item. Contacts nobody. */
export const observeStaleLeads: Observer = async (ctx) => {
  if (!hasRepository(MARKETING_REPOSITORY)) return [];
  const repo = getRepository<MarketingRepository>(MARKETING_REPOSITORY);
  const items = await repo.listLeadsNeedingAttention({
    now: ctx.now,
    staleAfterMs: ctx.staleAfterMs,
  });
  return items.slice(0, ctx.limit).map((item) => ({
    observerId: "lead.stale",
    actionType: "attention.flag" as const,
    targets: [{ module: "marketing", entity: "lead", id: item.leadId }],
    rationale: `Lead has had no recorded touch since ${new Date(
      item.lastTouchedAt,
    ).toISOString().slice(0, 10)} (${item.reasons.join(", ")}).`,
    values: { lastTouchedAt: item.lastTouchedAt, reasonCount: item.reasons.length },
    subject: `lead:${item.leadId}`,
  }));
};

/** Sent quotes with no recorded response — prepares a follow-up for review. */
export const observeStaleQuotes: Observer = async (ctx) => {
  if (!hasRepository(QUOTES_REPOSITORY)) return [];
  const repo = getRepository<QuotesRepository>(QUOTES_REPOSITORY);
  const quotes = await repo.listQuotes();
  return quotes
    .filter(
      (q) => q.status === "sent" && ctx.now - q.updatedAt >= ctx.staleAfterMs,
    )
    .slice(0, ctx.limit)
    .map((q) => ({
      observerId: "quote.stale",
      actionType: "followup.prepare" as const,
      targets: [
        { module: "quotes", entity: "quote", id: q.id },
        { module: "crm", entity: "customer", id: q.customerId },
      ],
      rationale: `Quote has been in "sent" with no recorded response for ${Math.floor(
        (ctx.now - q.updatedAt) / DAY_MS,
      )} day(s). A follow-up may be worthwhile — this is a suggestion, not a decision.`,
      values: { updatedAt: q.updatedAt, status: q.status },
      subject: `quote:${q.id}`,
    }));
};

/** Conversations awaiting a Skild reply — flags them internally. */
export const observeAwaitingResponse: Observer = async (ctx) => {
  if (!hasRepository(COMMUNICATION_REPOSITORY)) return [];
  const repo = getRepository<CommunicationRepository>(COMMUNICATION_REPOSITORY);
  const conversations = await repo.listConversations({ awaitingParty: "skild" });
  return conversations
    .filter((c) => ctx.now - c.updatedAt >= ctx.staleAfterMs)
    .slice(0, ctx.limit)
    .map((c) => ({
      observerId: "conversation.awaiting_skild",
      actionType: "attention.flag" as const,
      targets: [
        { module: "communication", entity: "conversation", id: c.id },
      ],
      rationale: `Conversation has been awaiting a Skild reply for ${Math.floor(
        (ctx.now - c.updatedAt) / DAY_MS,
      )} day(s).`,
      values: { updatedAt: c.updatedAt },
      subject: `conversation:${c.id}`,
    }));
};

export const OBSERVERS: Record<string, Observer> = {
  "lead.stale": observeStaleLeads,
  "quote.stale": observeStaleQuotes,
  "conversation.awaiting_skild": observeAwaitingResponse,
};

export function getObserver(id: string | undefined): Observer | undefined {
  return id ? OBSERVERS[id] : undefined;
}
