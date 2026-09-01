// Local in-memory + localStorage implementation of MarketingRepository.
// Repository implementations are the ONLY place allowed to touch storage.
//
// Storage keys (versioned envelopes — see ./storage.ts):
//   skildos.marketing.leads.v1
//   skildos.marketing.opportunities.v1
//   skildos.marketing.actions.v1
//   skildos.marketing.pagePerformance.v1
//   skildos.marketing.searchOpportunities.v1
//   skildos.marketing.localVisibility.v1
//
// Mutation ordering rule: validate → persist → emit → return.
// A validation failure must leave storage untouched and emit NO event.
//
// PHASE 11 BOUNDARY: nothing here sends, publishes, spends, or scrapes.
// Every "action" is a durable record of human-decided work. Every measured
// metric arrives from a human or a Phase 9 adapter and carries its
// `evidenceSource`; this module never invents a number.

import { newId } from "@/core/ids";
import { getIdentity } from "@/core/auth/identity";
import { emit } from "@/core/activity/emitter";
import { getRepository, hasRepository } from "@/core/data/registry";
import { MARKETING_EVENTS } from "../activity";
import { scoreLead, scoreSearchOpportunity } from "./scoring";
import {
  CLOSED_LEAD_STATUSES,
  EVIDENCE_SOURCES,
  LEAD_CHANNELS,
  LEAD_LOST_REASONS,
  LEAD_QUALIFICATIONS,
  LEAD_SOURCES,
  LEAD_STATUSES,
  LEAD_TRANSITIONS,
  LEAD_URGENCIES,
  MARKETING_ACTION_STATUSES,
  MARKETING_ACTION_TRANSITIONS,
  MARKETING_ACTION_TYPES,
  MARKETING_OPPORTUNITY_TYPES,
  PUBLIC_ACTION_TYPES,
  type AttributionTouch,
  type Lead,
  type LeadAttentionItem,
  type LeadAttentionReason,
  type LeadAwaitingParty,
  type LeadChain,
  type LeadConversionInput,
  type LeadCreateInput,
  type LeadListQuery,
  type LeadLostReason,
  type LeadQualification,
  type LeadStatus,
  type LeadUpdateInput,
  type LocalVisibilityInput,
  type LocalVisibilityRecord,
  type MarketingAction,
  type MarketingActionCreateInput,
  type MarketingActionListQuery,
  type MarketingActionStatus,
  type MarketingOpportunity,
  type MarketingOpportunityCreateInput,
  type MarketingOpportunityListQuery,
  type MarketingOpportunityUpdateInput,
  type PagePerformanceInput,
  type PagePerformanceRecord,
  type RetentionOpportunity,
  type SearchOpportunityInput,
  type SearchOpportunityRecord,
  type ServicePerformance,
  type SourcePerformance,
} from "./schemas";
import type { MarketingRepository } from "./repository";
import { readEnvelope, registerVersionedKey, writeEnvelope } from "./storage";

const K_LEADS = "skildos.marketing.leads.v1";
const K_OPPORTUNITIES = "skildos.marketing.opportunities.v1";
const K_ACTIONS = "skildos.marketing.actions.v1";
const K_PAGE_PERFORMANCE = "skildos.marketing.pagePerformance.v1";
const K_SEARCH_OPPORTUNITIES = "skildos.marketing.searchOpportunities.v1";
const K_LOCAL_VISIBILITY = "skildos.marketing.localVisibility.v1";

registerVersionedKey<Lead>({
  key: K_LEADS,
  currentVersion: 1,
  // v0 (bare array, pre-envelope) predates scoring; backfill so readers
  // never hit undefined. Future shape changes append a new migration here.
  migrations: {
    0: (records) =>
      (records as Lead[]).map((l) => ({
        ...l,
        score: l.score ?? 0,
        scoreReasons: l.scoreReasons ?? [],
        awaitingParty: l.awaitingParty ?? "none",
        qualification: l.qualification ?? "unknown",
      })),
  },
});
registerVersionedKey<MarketingOpportunity>({
  key: K_OPPORTUNITIES,
  currentVersion: 1,
  migrations: {
    0: (records) =>
      (records as MarketingOpportunity[]).map((o) => ({
        ...o,
        confidence: o.confidence ?? 0,
        evidenceSource: o.evidenceSource ?? "manual",
      })),
  },
});
registerVersionedKey<MarketingAction>({
  key: K_ACTIONS,
  currentVersion: 1,
  migrations: {
    0: (records) =>
      (records as MarketingAction[]).map((a) => ({
        ...a,
        publicFacing: a.publicFacing ?? false,
      })),
  },
});
registerVersionedKey<PagePerformanceRecord>({
  key: K_PAGE_PERFORMANCE,
  currentVersion: 1,
  migrations: { 0: (records) => records as PagePerformanceRecord[] },
});
registerVersionedKey<SearchOpportunityRecord>({
  key: K_SEARCH_OPPORTUNITIES,
  currentVersion: 1,
  migrations: {
    0: (records) =>
      (records as SearchOpportunityRecord[]).map((r) => ({
        ...r,
        opportunityScore: r.opportunityScore ?? 0,
        scoreReasons: r.scoreReasons ?? [],
      })),
  },
});
registerVersionedKey<LocalVisibilityRecord>({
  key: K_LOCAL_VISIBILITY,
  currentVersion: 1,
  migrations: { 0: (records) => records as LocalVisibilityRecord[] },
});

// ---- Cross-module reference checks -------------------------------------
// Marketing never imports another module. It resolves sibling repositories
// through the Data Registry and only validates when one is registered — so
// the module stays usable standalone (and in isolated tests).

type RefType =
  | "customer"
  | "vehicle"
  | "quote"
  | "job"
  | "invoice"
  | "conversation"
  | "service_request"
  | "knowledge";

const REF_REPOSITORIES: Partial<
  Record<RefType, { key: string; method: string }>
> = {
  customer: { key: "crm.customerRepository", method: "get" },
  vehicle: { key: "vehicles.vehicleRepository", method: "get" },
  quote: { key: "quotes.repository", method: "getQuote" },
  job: { key: "jobs.repository", method: "get" },
  invoice: { key: "finance.repository", method: "getInvoice" },
  conversation: {
    key: "communication.repository",
    method: "getConversation",
  },
  service_request: {
    key: "communication.repository",
    method: "getServiceRequest",
  },
  knowledge: { key: "knowledge.repository", method: "getDocument" },
  // `appointment` has no owning repository yet — references stay opaque.
};

async function refExists(type: RefType, id: string): Promise<boolean> {
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

async function assertRef(type: RefType, id?: string): Promise<void> {
  const trimmedId = id?.trim();
  if (!trimmedId) return;
  if (!(await refExists(type, trimmedId))) {
    throw new Error(`Unknown ${type} "${trimmedId}".`);
  }
}

// ---- Validation helpers -------------------------------------------------

function trimmed(v?: string | null): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

function assertOneOf<T extends string>(
  value: T,
  allowed: readonly T[],
  label: string,
): void {
  if (!allowed.includes(value)) {
    throw new Error(`Invalid ${label} "${value}".`);
  }
}

function assertTimestamp(value: number | undefined, label: string): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive epoch-ms timestamp.`);
  }
}

function assertNonNegative(value: number | undefined, label: string): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be zero or greater.`);
  }
}

/** Derived from status — never independently settable. */
function awaitingFor(status: LeadStatus): LeadAwaitingParty {
  switch (status) {
    case "new":
    case "qualifying":
    case "qualified":
    case "quote_prepared":
    case "follow_up":
      return "skild";
    case "awaiting_customer":
    case "quote_sent":
    case "considering":
    case "contacted":
      return "customer";
    default:
      return "none";
  }
}

function normalizeTouch(
  input: Omit<AttributionTouch, "at"> & { at?: number },
  fallbackAt: number,
): AttributionTouch {
  assertOneOf(input.source, LEAD_SOURCES, "lead source");
  assertTimestamp(input.at, "attribution.at");
  const touch: AttributionTouch = {
    source: input.source,
    at: input.at ?? fallbackAt,
  };
  const medium = trimmed(input.medium);
  if (medium) touch.medium = medium;
  const campaign = trimmed(input.campaign);
  if (campaign) touch.campaign = campaign;
  const landingPage = trimmed(input.landingPage);
  if (landingPage) touch.landingPage = landingPage;
  const referralSource = trimmed(input.referralSource);
  if (referralSource) touch.referralSource = referralSource;
  const sourceDetail = trimmed(input.sourceDetail);
  if (sourceDetail) touch.sourceDetail = sourceDetail;
  const integrationId = trimmed(input.integrationId);
  if (integrationId) touch.integrationId = integrationId;
  const externalRef = trimmed(input.externalRef);
  if (externalRef) touch.externalRef = externalRef;
  return touch;
}

const DAY_MS = 86_400_000;
const DEFAULT_STALE_MS = 7 * DAY_MS;

// ---- Implementation -----------------------------------------------------

export function createLocalMarketingRepository(): MarketingRepository {
  let leads: Lead[] = readEnvelope<Lead>(K_LEADS) ?? [];
  let opportunities: MarketingOpportunity[] =
    readEnvelope<MarketingOpportunity>(K_OPPORTUNITIES) ?? [];
  let actions: MarketingAction[] =
    readEnvelope<MarketingAction>(K_ACTIONS) ?? [];
  let pagePerformance: PagePerformanceRecord[] =
    readEnvelope<PagePerformanceRecord>(K_PAGE_PERFORMANCE) ?? [];
  let searchOpportunities: SearchOpportunityRecord[] =
    readEnvelope<SearchOpportunityRecord>(K_SEARCH_OPPORTUNITIES) ?? [];
  let localVisibility: LocalVisibilityRecord[] =
    readEnvelope<LocalVisibilityRecord>(K_LOCAL_VISIBILITY) ?? [];

  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  const persistLeads = () => writeEnvelope(K_LEADS, leads);
  const persistOpportunities = () =>
    writeEnvelope(K_OPPORTUNITIES, opportunities);
  const persistActions = () => writeEnvelope(K_ACTIONS, actions);

  const requireLead = (id: string): Lead => {
    const found = leads.find((l) => l.id === id);
    if (!found) throw new Error(`Unknown lead "${id}".`);
    return found;
  };

  const requireOpportunity = (id: string): MarketingOpportunity => {
    const found = opportunities.find((o) => o.id === id);
    if (!found) throw new Error(`Unknown marketing opportunity "${id}".`);
    return found;
  };

  const requireAction = (id: string): MarketingAction => {
    const found = actions.find((a) => a.id === id);
    if (!found) throw new Error(`Unknown marketing action "${id}".`);
    return found;
  };

  /** Recompute the deterministic score after any field change. */
  const rescore = (lead: Lead): Lead => {
    const { score, scoreReasons } = scoreLead(lead);
    return { ...lead, score, scoreReasons };
  };

  const saveLead = (next: Lead): Lead => {
    const scored = rescore(next);
    leads = leads.map((l) => (l.id === scored.id ? scored : l));
    persistLeads();
    return scored;
  };

  const replaceOpportunity = (next: MarketingOpportunity) => {
    opportunities = opportunities.map((o) => (o.id === next.id ? next : o));
    persistOpportunities();
  };

  const replaceAction = (next: MarketingAction) => {
    actions = actions.map((a) => (a.id === next.id ? next : a));
    persistActions();
  };

  return {
    // ---- Leads ----------------------------------------------------------
    async listLeads(query?: LeadListQuery) {
      const q = query ?? {};
      const needle = q.search?.trim().toLowerCase();
      let items = leads.filter((l) => {
        if (q.status && l.status !== q.status) return false;
        if (q.channel && l.channel !== q.channel) return false;
        if (q.customerId && l.customerId !== q.customerId) return false;
        if (q.qualification && l.qualification !== q.qualification)
          return false;
        if (q.awaitingParty && l.awaitingParty !== q.awaitingParty)
          return false;
        if (q.source && l.attribution.lastTouch.source !== q.source)
          return false;
        if (
          q.serviceRequested &&
          (l.serviceRequested ?? "").toLowerCase() !==
            q.serviceRequested.toLowerCase()
        ) {
          return false;
        }
        if (q.open && CLOSED_LEAD_STATUSES.includes(l.status)) return false;
        if (q.staleSince !== undefined) {
          const last = l.lastContactAt ?? l.createdAt;
          if (last > q.staleSince) return false;
        }
        if (q.followUpDueBy !== undefined) {
          if (l.nextFollowUpAt === undefined) return false;
          if (l.nextFollowUpAt > q.followUpDueBy) return false;
        }
        if (needle) {
          const hay = [
            l.serviceRequested,
            l.requestSummary,
            l.location,
            l.attribution.lastTouch.campaign,
            l.attribution.lastTouch.referralSource,
            ...(l.tags ?? []),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      });
      items = items.sort((a, b) => b.createdAt - a.createdAt);
      return q.limit ? items.slice(0, q.limit) : items;
    },

    async getLead(id) {
      return leads.find((l) => l.id === id);
    },

    async findLeadByExternalRef(integrationId, externalRef) {
      if (!integrationId || !externalRef) return undefined;
      return leads.find((l) =>
        [l.attribution.firstTouch, l.attribution.lastTouch].some(
          (t) =>
            t.integrationId === integrationId && t.externalRef === externalRef,
        ),
      );
    },

    async findLeadByServiceRequest(serviceRequestId) {
      if (!serviceRequestId) return undefined;
      return leads.find((l) => l.serviceRequestId === serviceRequestId);
    },

    async createLead(input: LeadCreateInput) {
      // ---- validate
      assertOneOf(input.channel, LEAD_CHANNELS, "lead channel");
      if (input.status) assertOneOf(input.status, LEAD_STATUSES, "lead status");
      if (input.qualification)
        assertOneOf(
          input.qualification,
          LEAD_QUALIFICATIONS,
          "lead qualification",
        );
      if (input.urgency)
        assertOneOf(input.urgency, LEAD_URGENCIES, "lead urgency");
      if (!input.attribution) throw new Error("Lead attribution is required.");
      assertTimestamp(input.nextFollowUpAt, "nextFollowUpAt");

      const customerId = trimmed(input.customerId);
      const vehicleId = trimmed(input.vehicleId);
      const conversationId = trimmed(input.conversationId);
      const serviceRequestId = trimmed(input.serviceRequestId);
      await assertRef("customer", customerId);
      await assertRef("vehicle", vehicleId);
      await assertRef("conversation", conversationId);
      await assertRef("service_request", serviceRequestId);

      const now = Date.now();
      const touch = normalizeTouch(input.attribution, now);

      // Idempotency: an adapter replaying the same provider event must not
      // create a second lead.
      if (touch.integrationId && touch.externalRef) {
        const existing = leads.find((l) =>
          [l.attribution.firstTouch, l.attribution.lastTouch].some(
            (t) =>
              t.integrationId === touch.integrationId &&
              t.externalRef === touch.externalRef,
          ),
        );
        if (existing) return existing;
      }
      if (serviceRequestId) {
        const existing = leads.find(
          (l) => l.serviceRequestId === serviceRequestId,
        );
        if (existing) return existing;
      }

      const status = input.status ?? "new";
      const base: Lead = {
        id: newId(),
        customerId,
        vehicleId,
        conversationId,
        serviceRequestId,
        channel: input.channel,
        status,
        awaitingParty: awaitingFor(status),
        qualification: input.qualification ?? "unknown",
        serviceRequested: trimmed(input.serviceRequested),
        requestSummary: trimmed(input.requestSummary),
        location: trimmed(input.location),
        urgency: input.urgency,
        attribution: { firstTouch: touch, lastTouch: touch },
        score: 0,
        scoreReasons: [],
        createdAt: now,
        updatedAt: now,
        nextFollowUpAt: input.nextFollowUpAt,
        tags: input.tags?.map((t) => t.trim()).filter(Boolean),
        metadata: input.metadata,
      };
      const { score, scoreReasons } = scoreLead(base);
      const lead: Lead = { ...base, score, scoreReasons };

      // ---- persist
      leads = [lead, ...leads];
      persistLeads();

      // ---- emit
      emit({
        type: MARKETING_EVENTS.leadCreated,
        moduleId: "marketing",
        summary: `Lead captured from ${touch.source}`,
        payload: {
          id: lead.id,
          source: touch.source,
          channel: lead.channel,
          status: lead.status,
          score: lead.score,
        },
      });
      notify();
      return lead;
    },

    async updateLead(id, patch: LeadUpdateInput) {
      const existing = requireLead(id);
      if (patch.urgency)
        assertOneOf(patch.urgency, LEAD_URGENCIES, "lead urgency");
      if (patch.qualification)
        assertOneOf(
          patch.qualification,
          LEAD_QUALIFICATIONS,
          "lead qualification",
        );
      if (patch.nextFollowUpAt != null)
        assertTimestamp(patch.nextFollowUpAt, "nextFollowUpAt");

      const customerId =
        patch.customerId !== undefined
          ? trimmed(patch.customerId)
          : existing.customerId;
      const vehicleId =
        patch.vehicleId !== undefined
          ? trimmed(patch.vehicleId)
          : existing.vehicleId;
      const conversationId =
        patch.conversationId !== undefined
          ? trimmed(patch.conversationId)
          : existing.conversationId;
      const serviceRequestId =
        patch.serviceRequestId !== undefined
          ? trimmed(patch.serviceRequestId)
          : existing.serviceRequestId;
      if (patch.customerId !== undefined) await assertRef("customer", customerId);
      if (patch.vehicleId !== undefined) await assertRef("vehicle", vehicleId);
      if (patch.conversationId !== undefined)
        await assertRef("conversation", conversationId);
      if (patch.serviceRequestId !== undefined)
        await assertRef("service_request", serviceRequestId);

      const changedFields = Object.keys(patch);
      const next: Lead = {
        ...existing,
        customerId,
        vehicleId,
        conversationId,
        serviceRequestId,
        serviceRequested:
          patch.serviceRequested !== undefined
            ? trimmed(patch.serviceRequested)
            : existing.serviceRequested,
        requestSummary:
          patch.requestSummary !== undefined
            ? trimmed(patch.requestSummary)
            : existing.requestSummary,
        location:
          patch.location !== undefined
            ? trimmed(patch.location)
            : existing.location,
        urgency: patch.urgency ?? existing.urgency,
        qualification: patch.qualification ?? existing.qualification,
        nextFollowUpAt:
          patch.nextFollowUpAt === null
            ? undefined
            : (patch.nextFollowUpAt ?? existing.nextFollowUpAt),
        tags: patch.tags ?? existing.tags,
        metadata: patch.metadata ?? existing.metadata,
        updatedAt: Date.now(),
      };
      const saved = saveLead(next);
      emit({
        type: MARKETING_EVENTS.leadUpdated,
        moduleId: "marketing",
        summary: "Lead updated",
        payload: { id, changedFields, score: saved.score },
      });
      notify();
      return saved;
    },

    async setLeadStatus(id, status: LeadStatus) {
      const existing = requireLead(id);
      assertOneOf(status, LEAD_STATUSES, "lead status");
      if (status === existing.status) return existing;
      const allowed = LEAD_TRANSITIONS[existing.status];
      if (!allowed.includes(status)) {
        throw new Error(
          `Lead cannot move from "${existing.status}" to "${status}".`,
        );
      }
      if (status === "lost") {
        throw new Error(
          "Use markLost() so a lost reason is always recorded.",
        );
      }
      const now = Date.now();
      const next: Lead = {
        ...existing,
        status,
        awaitingParty: awaitingFor(status),
        updatedAt: now,
      };
      const saved = saveLead(next);
      emit({
        type: MARKETING_EVENTS.leadStatusChanged,
        moduleId: "marketing",
        summary: `Lead ${existing.status} → ${status}`,
        payload: { id, from: existing.status, to: status },
      });
      if (status === "won") {
        emit({
          type: MARKETING_EVENTS.leadConverted,
          moduleId: "marketing",
          summary: "Lead won",
          payload: {
            id,
            quoteId: saved.quoteId,
            jobId: saved.jobId,
            invoiceId: saved.invoiceId,
            source: saved.attribution.lastTouch.source,
          },
        });
      }
      notify();
      return saved;
    },

    async recordContact(id, at?: number) {
      const existing = requireLead(id);
      assertTimestamp(at, "contact timestamp");
      const when = at ?? Date.now();
      const next: Lead = {
        ...existing,
        lastContactAt: when,
        firstResponseAt: existing.firstResponseAt ?? when,
        status: existing.status === "new" ? "contacted" : existing.status,
        awaitingParty: awaitingFor(
          existing.status === "new" ? "contacted" : existing.status,
        ),
        updatedAt: when,
      };
      const saved = saveLead(next);
      emit({
        type: MARKETING_EVENTS.leadContacted,
        moduleId: "marketing",
        summary: "Lead contact recorded",
        payload: { id, at: when, status: saved.status },
      });
      notify();
      return saved;
    },

    async setQualification(id, qualification: LeadQualification) {
      const existing = requireLead(id);
      assertOneOf(
        qualification,
        LEAD_QUALIFICATIONS,
        "lead qualification",
      );
      const saved = saveLead({
        ...existing,
        qualification,
        updatedAt: Date.now(),
      });
      emit({
        type: MARKETING_EVENTS.leadQualified,
        moduleId: "marketing",
        summary: `Lead qualification set to ${qualification}`,
        payload: { id, qualification, score: saved.score },
      });
      notify();
      return saved;
    },

    async scheduleFollowUp(id, at: number | null) {
      const existing = requireLead(id);
      if (at !== null) assertTimestamp(at, "follow-up timestamp");
      const saved = saveLead({
        ...existing,
        nextFollowUpAt: at ?? undefined,
        updatedAt: Date.now(),
      });
      emit({
        type: MARKETING_EVENTS.leadFollowUpScheduled,
        moduleId: "marketing",
        summary: at ? "Follow-up scheduled" : "Follow-up cleared",
        payload: { id, nextFollowUpAt: at ?? null },
      });
      notify();
      return saved;
    },

    async recordConversion(id, links: LeadConversionInput) {
      const existing = requireLead(id);
      const quoteId =
        links.quoteId !== undefined ? trimmed(links.quoteId) : existing.quoteId;
      const jobId =
        links.jobId !== undefined ? trimmed(links.jobId) : existing.jobId;
      const invoiceId =
        links.invoiceId !== undefined
          ? trimmed(links.invoiceId)
          : existing.invoiceId;
      const appointmentId =
        links.appointmentId !== undefined
          ? trimmed(links.appointmentId)
          : existing.appointmentId;
      if (links.quoteId !== undefined) await assertRef("quote", quoteId);
      if (links.jobId !== undefined) await assertRef("job", jobId);
      if (links.invoiceId !== undefined) await assertRef("invoice", invoiceId);

      const saved = saveLead({
        ...existing,
        quoteId,
        jobId,
        invoiceId,
        appointmentId,
        updatedAt: Date.now(),
      });
      emit({
        type: MARKETING_EVENTS.leadLinked,
        moduleId: "marketing",
        summary: "Lead linked to business records",
        payload: {
          id,
          quoteId: quoteId ?? null,
          appointmentId: appointmentId ?? null,
          jobId: jobId ?? null,
          invoiceId: invoiceId ?? null,
        },
      });
      notify();
      return saved;
    },

    async markLost(id, reason: LeadLostReason, detail?: string) {
      const existing = requireLead(id);
      assertOneOf(reason, LEAD_LOST_REASONS, "lost reason");
      if (existing.status === "won") {
        throw new Error("A won lead cannot be marked lost.");
      }
      const saved = saveLead({
        ...existing,
        status: "lost",
        awaitingParty: "none",
        lostReason: reason,
        lostDetail: trimmed(detail),
        updatedAt: Date.now(),
      });
      emit({
        type: MARKETING_EVENTS.leadLost,
        moduleId: "marketing",
        summary: `Lead lost (${reason})`,
        payload: {
          id,
          reason,
          from: existing.status,
          source: saved.attribution.lastTouch.source,
        },
      });
      notify();
      return saved;
    },

    async recordTouch(id, touch) {
      const existing = requireLead(id);
      const normalized = normalizeTouch(touch, Date.now());
      const saved = saveLead({
        ...existing,
        attribution: {
          firstTouch: existing.attribution.firstTouch,
          lastTouch: normalized,
        },
        updatedAt: Date.now(),
      });
      emit({
        type: MARKETING_EVENTS.leadAttributionUpdated,
        moduleId: "marketing",
        summary: `Last touch recorded from ${normalized.source}`,
        payload: {
          id,
          source: normalized.source,
          medium: normalized.medium ?? null,
          campaign: normalized.campaign ?? null,
        },
      });
      notify();
      return saved;
    },

    // ---- Derived lead intelligence --------------------------------------
    async listLeadsNeedingAttention(opts) {
      const now = opts?.now ?? Date.now();
      const staleAfter = opts?.staleAfterMs ?? DEFAULT_STALE_MS;
      const out: LeadAttentionItem[] = [];
      for (const l of leads) {
        if (CLOSED_LEAD_STATUSES.includes(l.status)) continue;
        const reasons: LeadAttentionReason[] = [];
        const lastTouchedAt = l.lastContactAt ?? l.createdAt;

        if (!l.lastContactAt) reasons.push("never_contacted");
        if (l.awaitingParty === "skild") reasons.push("awaiting_skild");
        if (l.nextFollowUpAt !== undefined) {
          if (l.nextFollowUpAt < now - DAY_MS) reasons.push("follow_up_overdue");
          else if (l.nextFollowUpAt <= now) reasons.push("follow_up_due");
        }
        if (now - lastTouchedAt > staleAfter) reasons.push("stale");
        if (
          l.status === "quote_sent" &&
          now - (l.lastContactAt ?? l.updatedAt) > staleAfter
        ) {
          reasons.push("quote_sent_no_response");
        }
        if (reasons.length === 0) continue;
        out.push({
          leadId: l.id,
          reasons,
          lastTouchedAt,
          nextFollowUpAt: l.nextFollowUpAt,
        });
      }
      return out.sort((a, b) => a.lastTouchedAt - b.lastTouchedAt);
    },

    async getLeadChain(id) {
      const l = leads.find((x) => x.id === id);
      if (!l) return undefined;
      const chain: LeadChain = { leadId: l.id };
      if (l.customerId) chain.customerId = l.customerId;
      if (l.vehicleId) chain.vehicleId = l.vehicleId;
      if (l.conversationId) chain.conversationId = l.conversationId;
      if (l.quoteId) chain.quoteId = l.quoteId;
      if (l.appointmentId) chain.appointmentId = l.appointmentId;
      if (l.jobId) chain.jobId = l.jobId;
      if (l.invoiceId) chain.invoiceId = l.invoiceId;
      return chain;
    },

    async getSourcePerformance() {
      const by = new Map<string, SourcePerformance>();
      for (const l of leads) {
        const source = l.attribution.lastTouch.source;
        const row =
          by.get(source) ??
          ({
            source,
            leads: 0,
            qualified: 0,
            quoted: 0,
            scheduled: 0,
            won: 0,
            lost: 0,
            invoiced: 0,
          } satisfies SourcePerformance);
        row.leads += 1;
        if (l.qualification === "qualified") row.qualified += 1;
        if (l.quoteId) row.quoted += 1;
        if (l.appointmentId || l.status === "scheduled") row.scheduled += 1;
        if (l.status === "won") row.won += 1;
        if (l.status === "lost") row.lost += 1;
        if (l.invoiceId) row.invoiced += 1;
        by.set(source, row);
      }
      return Array.from(by.values()).sort((a, b) => b.leads - a.leads);
    },

    async getServicePerformance() {
      const by = new Map<string, ServicePerformance>();
      for (const l of leads) {
        const service = l.serviceRequested?.trim() || "(unspecified)";
        const row =
          by.get(service) ??
          ({
            service,
            leads: 0,
            qualified: 0,
            quoted: 0,
            jobs: 0,
            won: 0,
            lost: 0,
          } satisfies ServicePerformance);
        row.leads += 1;
        if (l.qualification === "qualified") row.qualified += 1;
        if (l.quoteId) row.quoted += 1;
        if (l.jobId) row.jobs += 1;
        if (l.status === "won") row.won += 1;
        if (l.status === "lost") row.lost += 1;
        by.set(service, row);
      }
      return Array.from(by.values()).sort((a, b) => b.leads - a.leads);
    },

    async listRetentionOpportunities(opts) {
      const now = opts?.now ?? Date.now();
      const minDays = opts?.minDays ?? 180;
      if (!hasRepository("jobs.repository")) return [];
      let jobs: Array<{
        id: string;
        customerId: string;
        status: string;
        updatedAt: number;
      }> = [];
      try {
        const repo = getRepository<{
          list: (q?: unknown) => Promise<
            Array<{
              id: string;
              customerId: string;
              status: string;
              updatedAt: number;
            }>
          >;
        }>("jobs.repository");
        jobs = await repo.list();
      } catch {
        return [];
      }
      const latest = new Map<string, { id: string; at: number }>();
      for (const j of jobs) {
        if (j.status !== "completed") continue;
        const prev = latest.get(j.customerId);
        if (!prev || j.updatedAt > prev.at) {
          latest.set(j.customerId, { id: j.id, at: j.updatedAt });
        }
      }
      const out: RetentionOpportunity[] = [];
      for (const [customerId, last] of latest) {
        const days = Math.floor((now - last.at) / DAY_MS);
        if (days < minDays) continue;
        out.push({
          customerId,
          lastJobId: last.id,
          lastJobAt: last.at,
          daysSinceLastJob: days,
          reasons: [
            `completed work recorded ${days} days ago`,
            "no maintenance interval assumed — verify against service history",
          ],
        });
      }
      return out.sort(
        (a, b) => (b.daysSinceLastJob ?? 0) - (a.daysSinceLastJob ?? 0),
      );
    },

    // ---- Marketing opportunities -----------------------------------------
    async listOpportunities(query?: MarketingOpportunityListQuery) {
      const q = query ?? {};
      let items = opportunities.filter((o) => {
        if (q.type && o.type !== q.type) return false;
        if (q.status && o.status !== q.status) return false;
        if (q.jobId && o.jobId !== q.jobId) return false;
        if (
          q.service &&
          (o.service ?? "").toLowerCase() !== q.service.toLowerCase()
        ) {
          return false;
        }
        return true;
      });
      items = items.sort(
        (a, b) => b.confidence - a.confidence || b.createdAt - a.createdAt,
      );
      return q.limit ? items.slice(0, q.limit) : items;
    },

    async getOpportunity(id) {
      return opportunities.find((o) => o.id === id);
    },

    async createOpportunity(input: MarketingOpportunityCreateInput) {
      assertOneOf(
        input.type,
        MARKETING_OPPORTUNITY_TYPES,
        "opportunity type",
      );
      assertOneOf(input.evidenceSource, EVIDENCE_SOURCES, "evidence source");
      const title = trimmed(input.title);
      if (!title) throw new Error("Opportunity title is required.");
      const confidence = input.confidence ?? 50;
      if (!Number.isFinite(confidence) || confidence < 0 || confidence > 100) {
        throw new Error("Confidence must be between 0 and 100.");
      }
      const jobId = trimmed(input.jobId);
      const knowledgeDocumentId = trimmed(input.knowledgeDocumentId);
      // Content opportunities must trace to REAL completed work.
      if (input.type === "content_from_job" && !jobId) {
        throw new Error(
          "A content opportunity must reference the job it came from.",
        );
      }
      await assertRef("job", jobId);
      await assertRef("knowledge", knowledgeDocumentId);

      const now = Date.now();
      const opportunity: MarketingOpportunity = {
        id: newId(),
        type: input.type,
        title,
        service: trimmed(input.service),
        area: trimmed(input.area),
        topic: trimmed(input.topic),
        page: trimmed(input.page),
        jobId,
        knowledgeDocumentId,
        evidenceSource: input.evidenceSource,
        evidence: trimmed(input.evidence),
        confidence: Math.round(confidence),
        recommendation: trimmed(input.recommendation),
        status: "identified",
        createdAt: now,
        updatedAt: now,
      };
      opportunities = [opportunity, ...opportunities];
      persistOpportunities();
      emit({
        type: MARKETING_EVENTS.opportunityCreated,
        moduleId: "marketing",
        summary: `Marketing opportunity identified: ${title}`,
        payload: {
          id: opportunity.id,
          type: opportunity.type,
          evidenceSource: opportunity.evidenceSource,
          confidence: opportunity.confidence,
        },
      });
      notify();
      return opportunity;
    },

    async updateOpportunity(id, patch: MarketingOpportunityUpdateInput) {
      const existing = requireOpportunity(id);
      if (patch.confidence !== undefined) {
        if (
          !Number.isFinite(patch.confidence) ||
          patch.confidence < 0 ||
          patch.confidence > 100
        ) {
          throw new Error("Confidence must be between 0 and 100.");
        }
      }
      if (patch.title !== undefined && !trimmed(patch.title)) {
        throw new Error("Opportunity title is required.");
      }
      const next: MarketingOpportunity = {
        ...existing,
        title: trimmed(patch.title) ?? existing.title,
        service:
          patch.service !== undefined
            ? trimmed(patch.service)
            : existing.service,
        area: patch.area !== undefined ? trimmed(patch.area) : existing.area,
        topic:
          patch.topic !== undefined ? trimmed(patch.topic) : existing.topic,
        page: patch.page !== undefined ? trimmed(patch.page) : existing.page,
        evidence:
          patch.evidence !== undefined
            ? trimmed(patch.evidence)
            : existing.evidence,
        confidence:
          patch.confidence !== undefined
            ? Math.round(patch.confidence)
            : existing.confidence,
        recommendation:
          patch.recommendation !== undefined
            ? trimmed(patch.recommendation)
            : existing.recommendation,
        updatedAt: Date.now(),
      };
      replaceOpportunity(next);
      emit({
        type: MARKETING_EVENTS.opportunityUpdated,
        moduleId: "marketing",
        summary: "Marketing opportunity updated",
        payload: { id, changedFields: Object.keys(patch) },
      });
      notify();
      return next;
    },

    async reviewOpportunity(id) {
      const existing = requireOpportunity(id);
      if (existing.status !== "identified") {
        throw new Error(
          `Only an identified opportunity can be reviewed (is "${existing.status}").`,
        );
      }
      const now = Date.now();
      const next = {
        ...existing,
        status: "reviewing" as const,
        reviewedAt: now,
        updatedAt: now,
      };
      replaceOpportunity(next);
      emit({
        type: MARKETING_EVENTS.opportunityReviewed,
        moduleId: "marketing",
        summary: "Marketing opportunity under review",
        payload: { id },
      });
      notify();
      return next;
    },

    async approveOpportunity(id) {
      const existing = requireOpportunity(id);
      if (existing.status !== "reviewing" && existing.status !== "identified") {
        throw new Error(
          `Opportunity "${existing.status}" cannot be approved.`,
        );
      }
      const now = Date.now();
      const next = {
        ...existing,
        status: "approved" as const,
        reviewedAt: existing.reviewedAt ?? now,
        approvedAt: now,
        updatedAt: now,
      };
      replaceOpportunity(next);
      emit({
        type: MARKETING_EVENTS.opportunityApproved,
        moduleId: "marketing",
        summary: "Marketing opportunity approved",
        payload: { id, type: existing.type },
      });
      notify();
      return next;
    },

    async dismissOpportunity(id, reason?: string) {
      const existing = requireOpportunity(id);
      if (existing.status === "actioned") {
        throw new Error("An actioned opportunity cannot be dismissed.");
      }
      const now = Date.now();
      const next = {
        ...existing,
        status: "dismissed" as const,
        dismissedAt: now,
        dismissReason: trimmed(reason),
        updatedAt: now,
      };
      replaceOpportunity(next);
      emit({
        type: MARKETING_EVENTS.opportunityDismissed,
        moduleId: "marketing",
        summary: "Marketing opportunity dismissed",
        payload: { id, reason: trimmed(reason) ?? null },
      });
      notify();
      return next;
    },

    // ---- Marketing actions ------------------------------------------------
    async listActions(query?: MarketingActionListQuery) {
      const q = query ?? {};
      let items = actions.filter((a) => {
        if (q.status && a.status !== q.status) return false;
        if (q.type && a.type !== q.type) return false;
        if (q.opportunityId && a.opportunityId !== q.opportunityId)
          return false;
        return true;
      });
      items = items.sort((a, b) => b.createdAt - a.createdAt);
      return q.limit ? items.slice(0, q.limit) : items;
    },

    async getAction(id) {
      return actions.find((a) => a.id === id);
    },

    async createAction(input: MarketingActionCreateInput) {
      assertOneOf(input.type, MARKETING_ACTION_TYPES, "action type");
      const title = trimmed(input.title);
      if (!title) throw new Error("Action title is required.");
      const opportunityId = trimmed(input.opportunityId);
      if (opportunityId) requireOpportunity(opportunityId);

      const now = Date.now();
      const action: MarketingAction = {
        id: newId(),
        opportunityId,
        type: input.type,
        title,
        description: trimmed(input.description),
        target: trimmed(input.target),
        publicFacing:
          input.publicFacing ?? PUBLIC_ACTION_TYPES.includes(input.type),
        status: "recommended",
        createdAt: now,
        updatedAt: now,
      };
      actions = [action, ...actions];
      persistActions();
      if (opportunityId) {
        const opp = requireOpportunity(opportunityId);
        replaceOpportunity({
          ...opp,
          actionId: action.id,
          status: "actioned",
          updatedAt: now,
        });
      }
      emit({
        type: MARKETING_EVENTS.actionCreated,
        moduleId: "marketing",
        summary: `Marketing action recommended: ${title}`,
        payload: {
          id: action.id,
          type: action.type,
          opportunityId: opportunityId ?? null,
          publicFacing: action.publicFacing,
        },
      });
      notify();
      return action;
    },

    async reviewAction(id) {
      return transitionAction(id, "reviewed", MARKETING_EVENTS.actionReviewed);
    },

    async approveAction(id, approvedBy?: string) {
      const existing = requireAction(id);
      assertActionTransition(existing.status, "approved");
      const now = Date.now();
      const next: MarketingAction = {
        ...existing,
        status: "approved",
        approvedAt: now,
        approvedBy: trimmed(approvedBy) ?? getIdentity().id,
        updatedAt: now,
      };
      replaceAction(next);
      emit({
        type: MARKETING_EVENTS.actionApproved,
        moduleId: "marketing",
        summary: "Marketing action approved",
        payload: {
          id,
          type: next.type,
          publicFacing: next.publicFacing,
          approvedBy: next.approvedBy,
        },
      });
      notify();
      return next;
    },

    async markActionExecuted(id, note?: string) {
      const existing = requireAction(id);
      assertActionTransition(existing.status, "executed");
      const now = Date.now();
      const next: MarketingAction = {
        ...existing,
        status: "executed",
        executedAt: now,
        outcome: trimmed(note) ?? existing.outcome,
        updatedAt: now,
      };
      replaceAction(next);
      emit({
        type: MARKETING_EVENTS.actionExecuted,
        moduleId: "marketing",
        summary: "Marketing action recorded as executed",
        payload: { id, type: next.type, publicFacing: next.publicFacing },
      });
      notify();
      return next;
    },

    async measureAction(id, outcome: string) {
      const existing = requireAction(id);
      assertActionTransition(existing.status, "measured");
      const text = trimmed(outcome);
      if (!text) throw new Error("A measured outcome is required.");
      const now = Date.now();
      const next: MarketingAction = {
        ...existing,
        status: "measured",
        measuredAt: now,
        outcome: text,
        updatedAt: now,
      };
      replaceAction(next);
      emit({
        type: MARKETING_EVENTS.actionMeasured,
        moduleId: "marketing",
        summary: "Marketing action outcome measured",
        payload: { id, type: next.type },
      });
      notify();
      return next;
    },

    async rejectAction(id, reason?: string) {
      const existing = requireAction(id);
      assertActionTransition(existing.status, "rejected");
      const now = Date.now();
      const next: MarketingAction = {
        ...existing,
        status: "rejected",
        rejectedReason: trimmed(reason),
        updatedAt: now,
      };
      replaceAction(next);
      emit({
        type: MARKETING_EVENTS.actionRejected,
        moduleId: "marketing",
        summary: "Marketing action rejected",
        payload: { id, reason: trimmed(reason) ?? null },
      });
      notify();
      return next;
    },

    // ---- Website / search / local intelligence ----------------------------
    async listPagePerformance(page?: string) {
      const items = page
        ? pagePerformance.filter((r) => r.page === page)
        : pagePerformance;
      return [...items].sort((a, b) => b.periodEnd - a.periodEnd);
    },

    async recordPagePerformance(input: PagePerformanceInput) {
      const page = trimmed(input.page);
      if (!page) throw new Error("A page path is required.");
      assertOneOf(input.evidenceSource, EVIDENCE_SOURCES, "evidence source");
      assertTimestamp(input.periodStart, "periodStart");
      assertTimestamp(input.periodEnd, "periodEnd");
      if (input.periodEnd < input.periodStart) {
        throw new Error("periodEnd must be on or after periodStart.");
      }
      for (const [k, v] of Object.entries({
        visits: input.visits,
        landingSessions: input.landingSessions,
        quoteRequests: input.quoteRequests,
        schedulingStarts: input.schedulingStarts,
        conversions: input.conversions,
      })) {
        assertNonNegative(v as number | undefined, k);
      }
      if (input.source) assertOneOf(input.source, LEAD_SOURCES, "lead source");

      // Idempotency: the same provider record must not double-count.
      if (input.integrationId && input.externalRef) {
        const existing = pagePerformance.find(
          (r) =>
            r.integrationId === input.integrationId &&
            r.externalRef === input.externalRef,
        );
        if (existing) return existing;
      }

      const record: PagePerformanceRecord = {
        ...input,
        page,
        id: newId(),
        recordedAt: Date.now(),
      };
      pagePerformance = [record, ...pagePerformance];
      writeEnvelope(K_PAGE_PERFORMANCE, pagePerformance);
      emit({
        type: MARKETING_EVENTS.pagePerformanceRecorded,
        moduleId: "marketing",
        summary: `Page performance recorded for ${page}`,
        payload: {
          id: record.id,
          page,
          evidenceSource: record.evidenceSource,
        },
      });
      notify();
      return record;
    },

    async listSearchOpportunities(status) {
      const items = status
        ? searchOpportunities.filter((r) => r.status === status)
        : searchOpportunities;
      return [...items].sort(
        (a, b) => b.opportunityScore - a.opportunityScore,
      );
    },

    async recordSearchOpportunity(input: SearchOpportunityInput) {
      const query = trimmed(input.query);
      if (!query) throw new Error("A search query is required.");
      assertOneOf(input.evidenceSource, EVIDENCE_SOURCES, "evidence source");
      assertTimestamp(input.periodStart, "periodStart");
      assertTimestamp(input.periodEnd, "periodEnd");
      if (input.periodEnd < input.periodStart) {
        throw new Error("periodEnd must be on or after periodStart.");
      }
      assertNonNegative(input.impressions, "impressions");
      assertNonNegative(input.clicks, "clicks");
      if (input.position !== undefined && input.position <= 0) {
        throw new Error("position must be greater than zero.");
      }
      if (
        input.impressions !== undefined &&
        input.clicks !== undefined &&
        input.clicks > input.impressions
      ) {
        throw new Error("clicks cannot exceed impressions.");
      }

      if (input.integrationId && input.externalRef) {
        const existing = searchOpportunities.find(
          (r) =>
            r.integrationId === input.integrationId &&
            r.externalRef === input.externalRef,
        );
        if (existing) return existing;
      }

      const ctr =
        input.ctr ??
        (input.impressions && input.impressions > 0
          ? (input.clicks ?? 0) / input.impressions
          : undefined);
      const { score, reasons } = scoreSearchOpportunity({ ...input, ctr });
      const record: SearchOpportunityRecord = {
        ...input,
        query,
        ctr,
        id: newId(),
        opportunityScore: score,
        scoreReasons: reasons,
        status: input.status ?? "identified",
        recordedAt: Date.now(),
      };
      searchOpportunities = [record, ...searchOpportunities];
      writeEnvelope(K_SEARCH_OPPORTUNITIES, searchOpportunities);
      emit({
        type: MARKETING_EVENTS.searchOpportunityRecorded,
        moduleId: "marketing",
        summary: `Search opportunity recorded: ${query}`,
        payload: {
          id: record.id,
          score: record.opportunityScore,
          evidenceSource: record.evidenceSource,
        },
      });
      notify();
      return record;
    },

    async listLocalVisibility() {
      return [...localVisibility].sort((a, b) => b.periodEnd - a.periodEnd);
    },

    async recordLocalVisibility(input: LocalVisibilityInput) {
      const profile = trimmed(input.profile);
      if (!profile) throw new Error("A profile label is required.");
      assertOneOf(input.evidenceSource, EVIDENCE_SOURCES, "evidence source");
      assertTimestamp(input.periodStart, "periodStart");
      assertTimestamp(input.periodEnd, "periodEnd");
      if (input.periodEnd < input.periodStart) {
        throw new Error("periodEnd must be on or after periodStart.");
      }
      for (const [k, v] of Object.entries({
        views: input.views,
        calls: input.calls,
        websiteActions: input.websiteActions,
        directionRequests: input.directionRequests,
        reviewCount: input.reviewCount,
      })) {
        assertNonNegative(v as number | undefined, k);
      }
      if (
        input.averageRating !== undefined &&
        (input.averageRating < 0 || input.averageRating > 5)
      ) {
        throw new Error("averageRating must be between 0 and 5.");
      }

      if (input.integrationId && input.externalRef) {
        const existing = localVisibility.find(
          (r) =>
            r.integrationId === input.integrationId &&
            r.externalRef === input.externalRef,
        );
        if (existing) return existing;
      }

      const record: LocalVisibilityRecord = {
        ...input,
        profile,
        id: newId(),
        recordedAt: Date.now(),
      };
      localVisibility = [record, ...localVisibility];
      writeEnvelope(K_LOCAL_VISIBILITY, localVisibility);
      emit({
        type: MARKETING_EVENTS.localVisibilityRecorded,
        moduleId: "marketing",
        summary: `Local visibility recorded for ${profile}`,
        payload: { id: record.id, evidenceSource: record.evidenceSource },
      });
      notify();
      return record;
    },

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  // ---- Local helpers (closure over `actions`) ---------------------------

  function assertActionTransition(
    from: MarketingActionStatus,
    to: MarketingActionStatus,
  ): void {
    assertOneOf(to, MARKETING_ACTION_STATUSES, "action status");
    if (!MARKETING_ACTION_TRANSITIONS[from].includes(to)) {
      throw new Error(`Action cannot move from "${from}" to "${to}".`);
    }
  }

  function transitionAction(
    id: string,
    to: MarketingActionStatus,
    eventName: string,
  ): MarketingAction {
    const existing = requireAction(id);
    assertActionTransition(existing.status, to);
    const now = Date.now();
    const next: MarketingAction = {
      ...existing,
      status: to,
      reviewedAt: to === "reviewed" ? now : existing.reviewedAt,
      updatedAt: now,
    };
    replaceAction(next);
    emit({
      type: eventName,
      moduleId: "marketing",
      summary: `Marketing action ${to}`,
      payload: { id, type: next.type },
    });
    notify();
    return next;
  }
}
