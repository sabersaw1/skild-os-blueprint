// Local in-memory + localStorage implementation of QuotesRepository.
// Repository implementations are the ONLY place allowed to touch storage.
//
// Storage keys (versioned envelopes — see ./storage.ts):
//   skildos.quotes.quotes.v1
//   skildos.quotes.versions.v1
//
// Mutation ordering rule: validate → persist → emit → return.
// Every `updateQuote` also creates + persists an immutable QuoteVersion
// snapshot before emitting `quote.updated` / `quote.version.created`.

import { newId } from "@/core/ids";
import { getIdentity } from "@/core/auth/identity";
import { emit } from "@/core/activity/emitter";
import { QUOTE_EVENTS } from "../activity";
import {
  LINE_ITEM_CATEGORIES,
  QUOTE_STATUSES,
  type Quote,
  type QuoteCreateInput,
  type QuoteListQuery,
  type QuoteSnapshot,
  type QuoteStatus,
  type QuoteStatusChange,
  type QuoteStatusInput,
  type QuoteUpdateInput,
  type QuoteVersion,
  type LineItem,
  type LineItemInput,
} from "./schemas";
import { assertCents, isCents, toCents } from "@/core/money";
import { computeTotals, materializeLineItems } from "./totals";
import type { QuotesRepository } from "./repository";
import {
  readEnvelope,
  registerVersionedKey,
  writeEnvelope,
} from "./storage";
import { assertPersisted } from "@/core/storage/persistence";
import { withCapabilityEnforcement } from "@/core/auth/authorize";

// v2 (Phase 13.5): every monetary field moved from float dollars to
// integer cents. The key suffix is bumped so old data is migrated
// explicitly and never silently reinterpreted.
const K_QUOTES = "skildos.quotes.quotes.v2";
const K_VERSIONS = "skildos.quotes.versions.v2";

// Register versioned keys + migration hooks BEFORE any read/write.
// v0 (legacy bare array) → v1 (envelope). Pass-through migrations reserve
// the hook path for future schema changes.
registerVersionedKey<Quote>({
  key: K_QUOTES,
  currentVersion: 2,
  migrations: {
    0: (records) => records as Quote[],
    1: (records) => (records as LegacyQuote[]).map(migrateQuoteToCents),
  },
});
registerVersionedKey<QuoteVersion>({
  key: K_VERSIONS,
  currentVersion: 2,
  migrations: {
    0: (records) => records as QuoteVersion[],
    1: (records) =>
      (records as Array<QuoteVersion & { snapshot: LegacyQuote }>).map((v) => ({
        ...v,
        snapshot: migrateQuoteToCents(v.snapshot) as QuoteSnapshot,
      })),
  },
});

// ---- v1 → v2 money migration (float dollars → integer cents) -----------
// Explicit and lossless-by-rounding: 149.99 → 14999. Nothing is guessed;
// a value that is already an integer-cent field is left untouched because
// legacy records never carried the *Cents names.

interface LegacyQuote {
  lineItems?: Array<Record<string, unknown>>;
  subtotal?: number;
  discount?: number;
  tax?: number;
  total?: number;
  [k: string]: unknown;
}

function dollarsToCents(v: unknown): number {
  return toCents(typeof v === "number" ? v : 0);
}

function migrateQuoteToCents(legacy: LegacyQuote): Quote {
  const {
    subtotal,
    discount,
    tax,
    total,
    lineItems,
    ...rest
  } = legacy;
  return {
    ...(rest as unknown as Quote),
    lineItems: (lineItems ?? []).map((li) => {
      const { unitPrice, total: liTotal, ...liRest } = li as Record<
        string,
        unknown
      >;
      return {
        ...(liRest as unknown as LineItem),
        unitPriceCents: dollarsToCents(unitPrice),
        totalCents: dollarsToCents(liTotal),
      };
    }),
    subtotalCents: dollarsToCents(subtotal),
    discountCents: dollarsToCents(discount),
    taxCents: dollarsToCents(tax),
    totalCents: dollarsToCents(total),
  };
}

// ---- Validation ---------------------------------------------------------

function validateLineItems(items: LineItemInput[] | undefined): void {
  if (!items) return;
  items.forEach((li, idx) => {
    if (!li.description?.trim()) {
      throw new Error(`Line item #${idx + 1} description is required.`);
    }
    if (!LINE_ITEM_CATEGORIES.includes(li.category)) {
      throw new Error(`Line item #${idx + 1} category "${li.category}" invalid.`);
    }
    if (!Number.isFinite(li.quantity) || li.quantity < 0) {
      throw new Error(`Line item #${idx + 1} quantity must be >= 0.`);
    }
    if (!isCents(li.unitPriceCents)) {
      throw new Error(
        `Line item #${idx + 1} unitPriceCents must be a non-negative integer number of cents.`,
      );
    }
    if (
      li.laborHours !== undefined &&
      (!Number.isFinite(li.laborHours) || li.laborHours < 0)
    ) {
      throw new Error(`Line item #${idx + 1} laborHours must be >= 0.`);
    }
  });
}

function validateCreate(input: QuoteCreateInput): void {
  if (!input.customerId?.trim()) throw new Error("customerId is required.");
  if (!input.vehicleId?.trim()) throw new Error("vehicleId is required.");
  if (!input.title?.trim()) throw new Error("Quote title is required.");
  assertCents(input.discountCents, "discountCents");
  assertCents(input.taxCents, "taxCents");
  validateLineItems(input.lineItems);
}

function validateUpdate(patch: QuoteUpdateInput): void {
  if (!patch.changeReason?.trim()) {
    throw new Error("changeReason is required when editing a quote.");
  }
  if (patch.title !== undefined && !patch.title.trim()) {
    throw new Error("title cannot be empty.");
  }
  assertCents(patch.discountCents, "discountCents");
  assertCents(patch.taxCents, "taxCents");
  validateLineItems(patch.lineItems);
}

// ---- Snapshotting -------------------------------------------------------

function snapshotOf(q: Quote): QuoteSnapshot {
  return {
    id: q.id,
    customerId: q.customerId,
    vehicleId: q.vehicleId,
    inspectionId: q.inspectionId,
    title: q.title,
    status: q.status,
    lineItems: q.lineItems.map((li) => ({ ...li })),
    subtotalCents: q.subtotalCents,
    discountCents: q.discountCents,
    taxCents: q.taxCents,
    totalCents: q.totalCents,
    notes: q.notes,
  };
}

// ---- Status transitions -------------------------------------------------

const ALLOWED_STATUS_FLOW: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ["sent"],
  sent: ["approved", "declined", "expired"],
  approved: [],
  declined: [],
  expired: [],
};

function ensureTransition(from: QuoteStatus, to: QuoteStatus): void {
  if (!QUOTE_STATUSES.includes(to)) {
    throw new Error(`Invalid quote status "${to}".`);
  }
  if (from === to) return;
  if (!ALLOWED_STATUS_FLOW[from].includes(to)) {
    throw new Error(
      `Illegal quote status transition ${from} → ${to}.`,
    );
  }
}

// ---- Factory ------------------------------------------------------------

export function createLocalQuotesRepository(): QuotesRepository {
  let quotes: Quote[] = readEnvelope<Quote>(K_QUOTES) ?? [];
  let versions: QuoteVersion[] = readEnvelope<QuoteVersion>(K_VERSIONS) ?? [];

  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());
  const persistQuotes = () => assertPersisted(K_QUOTES, writeEnvelope(K_QUOTES, quotes));
  const persistVersions = () => assertPersisted(K_VERSIONS, writeEnvelope(K_VERSIONS, versions));
  const find = (id: string) => quotes.find((q) => q.id === id);

  function recordVersion(next: Quote, reason: string): QuoteVersion {
    const version: QuoteVersion = {
      id: newId(),
      quoteId: next.id,
      versionNumber: next.currentVersion,
      snapshot: snapshotOf(next),
      changedBy: getIdentity().id,
      changeReason: reason,
      createdAt: Date.now(),
    };
    versions = [...versions, version];
    persistVersions();
    return version;
  }

  function transitionStatus(
    id: string,
    to: QuoteStatus,
    eventType: string,
    input?: QuoteStatusInput,
  ): Quote {
    const existing = find(id);
    if (!existing) throw new Error(`Quote ${id} not found.`);
    ensureTransition(existing.status, to);
    const now = Date.now();
    const change: QuoteStatusChange = {
      from: existing.status,
      to,
      at: now,
      by: getIdentity().id,
      reason: input?.reason?.trim() || undefined,
    };
    const next: Quote = {
      ...existing,
      status: to,
      statusHistory: [...existing.statusHistory, change],
      updatedAt: now,
    };
    quotes = quotes.map((q) => (q.id === id ? next : q));
    persistQuotes();
    notify();
    emit({
      type: eventType,
      moduleId: "quotes",
      summary: `Quote "${next.title}" → ${to}`,
      payload: {
        quoteId: id,
        from: change.from,
        to: change.to,
        reason: change.reason,
      },
    });
    return next;
  }

  const repo: QuotesRepository = {
    async listQuotes(q: QuoteListQuery = {}) {
      let items = quotes.slice();
      if (q.customerId) items = items.filter((i) => i.customerId === q.customerId);
      if (q.vehicleId) items = items.filter((i) => i.vehicleId === q.vehicleId);
      if (q.inspectionId)
        items = items.filter((i) => i.inspectionId === q.inspectionId);
      if (q.status) items = items.filter((i) => i.status === q.status);
      if (q.search) {
        const s = q.search.toLowerCase();
        items = items.filter(
          (i) =>
            i.title.toLowerCase().includes(s) ||
            i.notes.toLowerCase().includes(s),
        );
      }
      items.sort((a, b) => b.updatedAt - a.updatedAt);
      return q.limit ? items.slice(0, q.limit) : items;
    },

    async getQuote(id) {
      return find(id);
    },

    async createQuote(input) {
      validateCreate(input);
      const lineItems: LineItem[] = materializeLineItems(
        input.lineItems ?? [],
        newId,
      );
      const totals = computeTotals(
        lineItems,
        input.discountCents,
        input.taxCents,
      );
      const now = Date.now();
      const quote: Quote = {
        id: newId(),
        customerId: input.customerId,
        vehicleId: input.vehicleId,
        inspectionId: input.inspectionId,
        title: input.title.trim(),
        status: "draft",
        lineItems,
        subtotalCents: totals.subtotalCents,
        discountCents: totals.discountCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        notes: input.notes?.trim() ?? "",
        statusHistory: [],
        currentVersion: 1,
        createdAt: now,
        updatedAt: now,
        createdBy: getIdentity().id,
      };
      quotes = [quote, ...quotes];
      persistQuotes();
      // Seed the immutable v1 snapshot so every quote has a baseline version.
      recordVersion(quote, "Initial version");
      notify();
      emit({
        type: QUOTE_EVENTS.created,
        moduleId: "quotes",
        summary: `Created quote "${quote.title}"`,
        payload: {
          quoteId: quote.id,
          customerId: quote.customerId,
          vehicleId: quote.vehicleId,
          inspectionId: quote.inspectionId,
          totalCents: quote.totalCents,
        },
      });
      emit({
        type: QUOTE_EVENTS.versionCreated,
        moduleId: "quotes",
        summary: `Quote "${quote.title}" version 1 recorded`,
        payload: {
          quoteId: quote.id,
          versionNumber: 1,
          changeReason: "Initial version",
        },
      });
      return quote;
    },

    async updateQuote(id, patch) {
      const existing = find(id);
      if (!existing) throw new Error(`Quote ${id} not found.`);
      if (existing.status !== "draft") {
        throw new Error(
          `Only draft quotes can be edited (current status: ${existing.status}).`,
        );
      }
      validateUpdate(patch);
      const nextLineItems: LineItem[] = patch.lineItems
        ? materializeLineItems(patch.lineItems, newId)
        : existing.lineItems;
      const nextDiscount =
        patch.discountCents !== undefined
          ? patch.discountCents
          : existing.discountCents;
      const nextTax =
        patch.taxCents !== undefined ? patch.taxCents : existing.taxCents;
      const totals = computeTotals(nextLineItems, nextDiscount, nextTax);
      const nextVersionNumber = existing.currentVersion + 1;
      const next: Quote = {
        ...existing,
        title: patch.title?.trim() ?? existing.title,
        inspectionId:
          patch.inspectionId === null
            ? undefined
            : patch.inspectionId !== undefined
              ? patch.inspectionId
              : existing.inspectionId,
        lineItems: nextLineItems,
        subtotalCents: totals.subtotalCents,
        discountCents: totals.discountCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        notes: patch.notes !== undefined ? patch.notes : existing.notes,
        currentVersion: nextVersionNumber,
        updatedAt: Date.now(),
      };
      quotes = quotes.map((q) => (q.id === id ? next : q));
      persistQuotes();
      const version = recordVersion(next, patch.changeReason.trim());
      notify();
      emit({
        type: QUOTE_EVENTS.updated,
        moduleId: "quotes",
        summary: `Updated quote "${next.title}"`,
        payload: {
          quoteId: id,
          fields: Object.keys(patch).filter((k) => k !== "changeReason"),
          versionNumber: next.currentVersion,
        },
      });
      emit({
        type: QUOTE_EVENTS.versionCreated,
        moduleId: "quotes",
        summary: `Quote "${next.title}" version ${version.versionNumber} recorded`,
        payload: {
          quoteId: id,
          versionNumber: version.versionNumber,
          changeReason: version.changeReason,
        },
      });
      return next;
    },

    async sendQuote(id, input) {
      return transitionStatus(id, "sent", QUOTE_EVENTS.sent, input);
    },
    async approveQuote(id, input) {
      return transitionStatus(id, "approved", QUOTE_EVENTS.approved, input);
    },
    async declineQuote(id, input) {
      return transitionStatus(id, "declined", QUOTE_EVENTS.declined, input);
    },
    async expireQuote(id, input) {
      return transitionStatus(id, "expired", QUOTE_EVENTS.expired, input);
    },

    async listVersions(quoteId) {
      return versions
        .filter((v) => v.quoteId === quoteId)
        .slice()
        .sort((a, b) => a.versionNumber - b.versionNumber);
    },

    async getVersion(id) {
      return versions.find((v) => v.id === id);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

    // Authorization boundary — see src/core/auth/authorize.ts. Enforced at the
  // repository so a non-UI caller (agent, adapter, command) cannot bypass it.
  return withCapabilityEnforcement(repo, {
    createQuote: "quotes.write",
    updateQuote: "quotes.write",
    sendQuote: "quotes.write",
    approveQuote: "quotes.approve",
    declineQuote: "quotes.write",
    expireQuote: "quotes.write",
  });
}
