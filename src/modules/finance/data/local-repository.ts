// Local in-memory + localStorage implementation of FinanceRepository.
// Repository implementations are the ONLY place allowed to touch storage.
//
// Storage keys (versioned envelopes — see ./storage.ts):
//   skildos.finance.invoices.v1
//   skildos.finance.snapshots.v1
//   skildos.finance.payments.v1
//
// Mutation ordering rule: validate → persist → emit → return.
//
// SNAPSHOT PRINCIPLE: once an invoice leaves `draft` it is a financial
// record. Its lines and money fields can never change again; the only
// permitted transitions are payment recording and voiding (with a reason).

import { newId } from "@/core/ids";
import { getIdentity } from "@/core/auth/identity";
import { emit } from "@/core/activity/emitter";
import { assertCents, formatCents } from "@/core/money";
import { hasRepository, getRepository } from "@/core/data/registry";
import { FINANCE_EVENTS } from "../activity";
import {
  INVOICE_LINE_CATEGORIES,
  PAYMENT_METHODS,
  type Invoice,
  type InvoiceCreateInput,
  type InvoiceLineInput,
  type InvoiceListQuery,
  type InvoiceSnapshot,
  type InvoiceUpdateInput,
  type IssueInvoiceInput,
  type Payment,
  type PaymentInput,
  type VoidInvoiceInput,
} from "./schemas";
import type { FinanceRepository } from "./repository";
import { computeInvoiceTotals, materializeLines, nextInvoiceNumber } from "./totals";
import { readEnvelope, registerVersionedKey, writeEnvelope } from "./storage";
import { commitRecords } from "@/core/storage/persistence";
import { withCapabilityEnforcement } from "@/core/auth/authorize";

const K_INVOICES = "skildos.finance.invoices.v1";
const K_SNAPSHOTS = "skildos.finance.snapshots.v1";
const K_PAYMENTS = "skildos.finance.payments.v1";

const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;

registerVersionedKey<Invoice>({
  key: K_INVOICES,
  currentVersion: 1,
  migrations: { 0: (records) => records as Invoice[] },
});
registerVersionedKey<InvoiceSnapshot>({
  key: K_SNAPSHOTS,
  currentVersion: 1,
  migrations: { 0: (records) => records as InvoiceSnapshot[] },
});
registerVersionedKey<Payment>({
  key: K_PAYMENTS,
  currentVersion: 1,
  migrations: { 0: (records) => records as Payment[] },
});

// ---- Cross-module reference checks -------------------------------------
// Finance never imports another module. It resolves sibling repositories
// through the Data Registry, and only validates when one is registered —
// so the module stays usable standalone (and in isolated tests).

async function refExists(
  key: string,
  id: string,
  read: (repo: never) => Promise<unknown>,
): Promise<boolean> {
  if (!id) return true;
  if (!hasRepository(key)) return true;
  try {
    const repo = getRepository<never>(key);
    return Boolean(await read(repo));
  } catch {
    return true;
  }
}

async function assertReferences(input: {
  customerId?: string;
  vehicleId?: string;
  jobId?: string;
  quoteId?: string;
}): Promise<void> {
  const checks: Array<[string, string | undefined, string]> = [
    ["crm.customerRepository", input.customerId, "customer"],
    ["vehicles.vehicleRepository", input.vehicleId, "vehicle"],
    ["jobs.repository", input.jobId, "job"],
    ["quotes.repository", input.quoteId, "quote"],
  ];
  for (const [key, id, label] of checks) {
    if (!id) continue;
    const getter =
      key === "quotes.repository"
        ? (r: never) =>
            (r as unknown as { getQuote(i: string): Promise<unknown> }).getQuote(id)
        : (r: never) =>
            (r as unknown as { get(i: string): Promise<unknown> }).get(id);
    const ok = await refExists(key, id, getter);
    if (!ok) throw new Error(`Unknown ${label} "${id}".`);
  }
}

// ---- Validation ---------------------------------------------------------

function trimmed(v?: string | null): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

function validateLineInput(li: InvoiceLineInput, index: number): void {
  const at = `line ${index + 1}`;
  if (!li.description?.trim()) throw new Error(`${at}: description is required.`);
  if (!Number.isFinite(li.quantity) || li.quantity <= 0) {
    throw new Error(`${at}: quantity must be greater than 0.`);
  }
  if (li.category && !INVOICE_LINE_CATEGORIES.includes(li.category)) {
    throw new Error(`${at}: invalid category "${li.category}".`);
  }
  assertCents(li.unitPrice, `${at}: unitPrice`);
}

function validateMoneyFields(discount?: number, tax?: number): void {
  assertCents(discount, "discount");
  assertCents(tax, "tax");
}

function assertDraft(invoice: Invoice, action: string): void {
  if (invoice.status !== "draft") {
    throw new Error(
      `Invoice ${invoice.number} is ${invoice.status} and can no longer be ${action}. ` +
        `Issued invoices are immutable — void and re-issue instead.`,
    );
  }
}

function deepFreezeInvoice(invoice: Invoice): Invoice {
  const copy: Invoice = {
    ...invoice,
    lines: invoice.lines.map((l) => Object.freeze({ ...l })),
  };
  Object.freeze(copy.lines);
  return Object.freeze(copy);
}

// ---- Implementation -----------------------------------------------------

export function createLocalFinanceRepository(): FinanceRepository {
  let invoices: Invoice[] = readEnvelope<Invoice>(K_INVOICES) ?? [];
  let snapshots: InvoiceSnapshot[] = readEnvelope<InvoiceSnapshot>(K_SNAPSHOTS) ?? [];
  let payments: Payment[] = readEnvelope<Payment>(K_PAYMENTS) ?? [];

  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  // Persistence commit: in-memory state advances ONLY on a durable write.
  // A failure throws PersistenceError before any emit() runs.
  const persistInvoices = (next: Invoice[]) => {
    invoices = commitRecords(K_INVOICES, next);
  };
  const persistSnapshots = (next: InvoiceSnapshot[]) => {
    snapshots = commitRecords(K_SNAPSHOTS, next);
  };
  const persistPayments = (next: Payment[]) => {
    payments = commitRecords(K_PAYMENTS, next);
  };

  const require = (id: string): Invoice => {
    const found = invoices.find((i) => i.id === id);
    if (!found) throw new Error(`Unknown invoice "${id}".`);
    return found;
  };

  const replace = (next: Invoice) => {
    persistInvoices(invoices.map((i) => (i.id === next.id ? next : i)));
  };

  const impl: FinanceRepository = {
    // ---- Invoices -------------------------------------------------------
    async listInvoices(query?: InvoiceListQuery): Promise<Invoice[]> {
      const q = query ?? {};
      const needle = q.search?.trim().toLowerCase();
      let items = invoices.filter((inv) => {
        if (q.customerId && inv.customerId !== q.customerId) return false;
        if (q.vehicleId && inv.vehicleId !== q.vehicleId) return false;
        if (q.jobId && inv.jobId !== q.jobId) return false;
        if (q.quoteId && inv.quoteId !== q.quoteId) return false;
        if (q.status && inv.status !== q.status) return false;
        if (q.outstandingOnly && !(inv.balance > 0 && inv.status !== "void")) {
          return false;
        }
        const when = inv.issuedAt ?? inv.createdAt;
        if (q.from !== undefined && when < q.from) return false;
        if (q.to !== undefined && when > q.to) return false;
        if (needle) {
          const hay = [inv.number, inv.notes, inv.terms]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      });
      items = items.sort(
        (a, b) => (b.issuedAt ?? b.createdAt) - (a.issuedAt ?? a.createdAt),
      );
      return q.limit ? items.slice(0, q.limit) : items;
    },

    async getInvoice(id) {
      return invoices.find((i) => i.id === id);
    },

    async createInvoice(input: InvoiceCreateInput): Promise<Invoice> {
      if (!input.customerId?.trim()) throw new Error("customerId is required.");
      (input.lines ?? []).forEach(validateLineInput);
      validateMoneyFields(input.discount, input.tax);
      await assertReferences({
        customerId: input.customerId.trim(),
        vehicleId: trimmed(input.vehicleId),
        jobId: trimmed(input.jobId),
        quoteId: trimmed(input.quoteId),
      });

      const now = Date.now();
      const lines = materializeLines(input.lines ?? [], newId);
      const totals = computeInvoiceTotals(lines, input.discount, input.tax);
      const invoice: Invoice = {
        id: newId(),
        number: nextInvoiceNumber(invoices.map((i) => i.number)),
        customerId: input.customerId.trim(),
        vehicleId: trimmed(input.vehicleId),
        jobId: trimmed(input.jobId),
        quoteId: trimmed(input.quoteId),
        status: "draft",
        currency: "USD",
        lines,
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax: totals.tax,
        total: totals.total,
        amountPaid: 0,
        balance: totals.total,
        terms: trimmed(input.terms),
        notes: trimmed(input.notes),
        dueAt: input.dueAt,
        createdAt: now,
        updatedAt: now,
        createdBy: getIdentity().id,
      };

      persistInvoices([invoice, ...invoices]);
      emit({
        type: FINANCE_EVENTS.invoiceCreated,
        moduleId: "finance",
        summary: `Invoice ${invoice.number} created (${formatCents(invoice.total)})`,
        payload: { invoiceId: invoice.id, customerId: invoice.customerId },
      });
      notify();
      return invoice;
    },

    async updateInvoice(id, patch: InvoiceUpdateInput): Promise<Invoice> {
      const existing = require(id);
      assertDraft(existing, "edited");
      if (patch.lines) patch.lines.forEach(validateLineInput);
      validateMoneyFields(patch.discount, patch.tax);
      await assertReferences({
        vehicleId: patch.vehicleId ?? undefined,
        jobId: patch.jobId ?? undefined,
        quoteId: patch.quoteId ?? undefined,
      });

      const lines = patch.lines
        ? materializeLines(patch.lines, newId)
        : existing.lines;
      const totals = computeInvoiceTotals(
        lines,
        patch.discount ?? existing.discount,
        patch.tax ?? existing.tax,
      );

      const next: Invoice = {
        ...existing,
        vehicleId:
          patch.vehicleId === null
            ? undefined
            : patch.vehicleId !== undefined
              ? trimmed(patch.vehicleId)
              : existing.vehicleId,
        jobId:
          patch.jobId === null
            ? undefined
            : patch.jobId !== undefined
              ? trimmed(patch.jobId)
              : existing.jobId,
        quoteId:
          patch.quoteId === null
            ? undefined
            : patch.quoteId !== undefined
              ? trimmed(patch.quoteId)
              : existing.quoteId,
        lines,
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax: totals.tax,
        total: totals.total,
        balance: Math.max(0, totals.total - existing.amountPaid),
        terms: patch.terms !== undefined ? trimmed(patch.terms) : existing.terms,
        notes: patch.notes !== undefined ? trimmed(patch.notes) : existing.notes,
        dueAt:
          patch.dueAt === null
            ? undefined
            : patch.dueAt !== undefined
              ? patch.dueAt
              : existing.dueAt,
        updatedAt: Date.now(),
      };

      replace(next);
      emit({
        type: FINANCE_EVENTS.invoiceUpdated,
        moduleId: "finance",
        summary: `Invoice ${next.number} updated (${formatCents(next.total)})`,
        payload: { invoiceId: next.id },
      });
      notify();
      return next;
    },

    // ---- Lifecycle ------------------------------------------------------
    async issueInvoice(id, input?: IssueInvoiceInput): Promise<Invoice> {
      const existing = require(id);
      assertDraft(existing, "issued");
      if (existing.lines.length === 0) {
        throw new Error("An invoice must have at least one line before issuing.");
      }
      if (existing.total <= 0) {
        throw new Error("An invoice total must be greater than zero to issue.");
      }

      const now = Date.now();
      const next: Invoice = {
        ...existing,
        status: "issued",
        issuedAt: now,
        dueAt: input?.dueAt ?? existing.dueAt ?? now + FOURTEEN_DAYS,
        updatedAt: now,
      };
      replace(next);

      const snapshot: InvoiceSnapshot = {
        id: newId(),
        invoiceId: next.id,
        number: next.number,
        issuedAt: now,
        issuedBy: getIdentity().id,
        invoice: deepFreezeInvoice(next),
      };
      const invoicesBeforeSnapshot = invoices;
      try {
        persistSnapshots([snapshot, ...snapshots]);
      } catch (err) {
        // The immutable snapshot IS the financial record — if it cannot be
        // stored, the invoice must not stay "issued".
        invoices = invoicesBeforeSnapshot;
        writeEnvelope(K_INVOICES, invoicesBeforeSnapshot);
        throw err;
      }

      emit({
        type: FINANCE_EVENTS.invoiceIssued,
        moduleId: "finance",
        summary: `Invoice ${next.number} issued (${formatCents(next.total)})`,
        payload: {
          invoiceId: next.id,
          snapshotId: snapshot.id,
          total: next.total,
          note: input?.note,
        },
      });
      notify();
      return next;
    },

    async voidInvoice(id, input: VoidInvoiceInput): Promise<Invoice> {
      const existing = require(id);
      if (!input?.reason?.trim()) {
        throw new Error("A void reason is required.");
      }
      if (existing.status === "void") {
        throw new Error(`Invoice ${existing.number} is already void.`);
      }
      if (existing.status === "draft") {
        throw new Error(
          `Invoice ${existing.number} is still a draft — delete or edit it instead of voiding.`,
        );
      }

      const now = Date.now();
      const next: Invoice = {
        ...existing,
        status: "void",
        voidedAt: now,
        voidReason: input.reason.trim(),
        balance: 0,
        updatedAt: now,
      };
      replace(next);
      emit({
        type: FINANCE_EVENTS.invoiceVoided,
        moduleId: "finance",
        summary: `Invoice ${next.number} voided: ${next.voidReason}`,
        payload: { invoiceId: next.id, reason: next.voidReason },
      });
      notify();
      return next;
    },

    // ---- Snapshots ------------------------------------------------------
    async listSnapshots(invoiceId) {
      return snapshots
        .filter((s) => s.invoiceId === invoiceId)
        .sort((a, b) => b.issuedAt - a.issuedAt);
    },

    async getSnapshot(id) {
      return snapshots.find((s) => s.id === id);
    },

    // ---- Payments -------------------------------------------------------
    async recordPayment(invoiceId, input: PaymentInput): Promise<Payment> {
      const invoice = require(invoiceId);
      if (invoice.status === "draft") {
        throw new Error(
          `Invoice ${invoice.number} must be issued before payments can be recorded.`,
        );
      }
      if (invoice.status === "void") {
        throw new Error(`Invoice ${invoice.number} is void.`);
      }
      if (invoice.status === "paid") {
        throw new Error(`Invoice ${invoice.number} is already paid in full.`);
      }
      assertCents(input.amount, "amount");
      if (!input.amount || input.amount <= 0) {
        throw new Error("Payment amount must be greater than zero.");
      }
      if (input.amount > invoice.balance) {
        throw new Error(
          `Payment of ${formatCents(input.amount)} exceeds the outstanding balance of ${formatCents(invoice.balance)}.`,
        );
      }
      if (!PAYMENT_METHODS.includes(input.method)) {
        throw new Error(`Invalid payment method "${input.method}".`);
      }

      const now = Date.now();
      const payment: Payment = {
        id: newId(),
        invoiceId,
        amount: input.amount,
        method: input.method,
        reference: trimmed(input.reference),
        note: trimmed(input.note),
        paidAt: input.paidAt ?? now,
        createdAt: now,
        createdBy: getIdentity().id,
      };
      const paymentsBeforeWrite = payments;
      persistPayments([payment, ...payments]);

      const amountPaid = invoice.amountPaid + payment.amount;
      const balance = Math.max(0, invoice.total - amountPaid);
      const settled = balance === 0;
      const next: Invoice = {
        ...invoice,
        amountPaid,
        balance,
        status: settled ? "paid" : "partially_paid",
        paidAt: settled ? now : invoice.paidAt,
        updatedAt: now,
      };
      try {
        replace(next);
      } catch (err) {
        // Roll the payment back so a failed invoice write cannot leave an
        // orphaned payment behind.
        payments = paymentsBeforeWrite;
        writeEnvelope(K_PAYMENTS, paymentsBeforeWrite);
        throw err;
      }

      emit({
        type: FINANCE_EVENTS.paymentRecorded,
        moduleId: "finance",
        summary: `Payment ${formatCents(payment.amount)} recorded on ${next.number}`,
        payload: {
          invoiceId,
          paymentId: payment.id,
          method: payment.method,
          balance,
        },
      });
      emit({
        type: settled
          ? FINANCE_EVENTS.invoicePaid
          : FINANCE_EVENTS.invoicePartiallyPaid,
        moduleId: "finance",
        summary: settled
          ? `Invoice ${next.number} paid in full`
          : `Invoice ${next.number} partially paid — ${formatCents(balance)} outstanding`,
        payload: { invoiceId, amountPaid, balance },
      });
      notify();
      return payment;
    },

    async listPayments(invoiceId) {
      return payments
        .filter((p) => p.invoiceId === invoiceId)
        .sort((a, b) => b.paidAt - a.paidAt);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  // Authorization boundary — see src/core/auth/authorize.ts. Every
  // consequential mutation verifies the CURRENT actor's capability before
  // any validation, persistence, or activity emission, so a non-UI caller
  // (agent, adapter, command) cannot bypass the gate the UI applies.
  return withCapabilityEnforcement(impl, {
    createInvoice: "finance.invoice.write",
    updateInvoice: "finance.invoice.write",
    issueInvoice: "finance.invoice.issue",
    voidInvoice: "finance.invoice.void",
    recordPayment: "finance.payment.write",
  });
}
