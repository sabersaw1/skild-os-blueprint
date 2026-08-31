// Unit + integration tests for the Finance local repository.
// Mirrors the Parts / Jobs test setup: in-memory localStorage polyfill
// installed before importing the repository module.

import { beforeEach, describe, expect, it, vi } from "vitest";

class MemoryStorage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  key(i: number) {
    return Array.from(this.store.keys())[i] ?? null;
  }
  getItem(k: string) {
    return this.store.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.store.set(k, String(v));
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).window = globalThis;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).localStorage = new MemoryStorage();

import { createLocalFinanceRepository } from "./local-repository";
import { FINANCE_EVENTS } from "../activity";
import { computeInvoiceTotals, nextInvoiceNumber } from "./totals";
import { formatCents, toCents } from "@/core/money";
import * as emitter from "@/core/activity/emitter";
import {
  clearRepository,
  getRepository,
  registerRepository,
} from "@/core/data/registry";
import { FINANCE_REPOSITORY, type FinanceRepository } from "./repository";

function fresh(): FinanceRepository {
  (
    globalThis as unknown as { localStorage: MemoryStorage }
  ).localStorage.clear();
  clearRepository();
  return createLocalFinanceRepository();
}

const LINES = [
  { description: "Front brake pads", category: "part" as const, quantity: 1, unitPrice: 8999 },
  { description: "Labor", category: "labor" as const, quantity: 1.5, unitPrice: 12000 },
];

async function draft(repo: FinanceRepository) {
  return repo.createInvoice({ customerId: "cust-1", lines: LINES, tax: 1000 });
}

describe("finance totals — integer cents", () => {
  it("computes subtotal, discount, tax, total", () => {
    const t = computeInvoiceTotals(
      [{ lineTotal: 8999 }, { lineTotal: 18000 }],
      500,
      1000,
    );
    expect(t.subtotal).toBe(26999);
    expect(t.total).toBe(27499);
  });

  it("never produces a negative total", () => {
    expect(computeInvoiceTotals([{ lineTotal: 100 }], 5000).total).toBe(0);
  });

  it("keeps float dollars out of storage", () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(formatCents(27499)).toContain("274.99");
  });

  it("assigns sequential invoice numbers", () => {
    expect(nextInvoiceNumber([])).toBe("INV-0001");
    expect(nextInvoiceNumber(["INV-0001", "INV-0009"])).toBe("INV-0010");
  });
});

describe("FinanceRepository — draft invoices", () => {
  let repo: FinanceRepository;
  beforeEach(() => {
    repo = fresh();
  });

  it("creates a draft with computed totals and a number", async () => {
    const inv = await draft(repo);
    expect(inv.number).toBe("INV-0001");
    expect(inv.status).toBe("draft");
    expect(inv.subtotal).toBe(8999 + 18000);
    expect(inv.total).toBe(8999 + 18000 + 1000);
    expect(inv.balance).toBe(inv.total);
    expect(inv.amountPaid).toBe(0);
    expect(Number.isSafeInteger(inv.total)).toBe(true);
  });

  it("requires a customer", async () => {
    await expect(repo.createInvoice({ customerId: "" })).rejects.toThrow(
      /customerId is required/,
    );
  });

  it("rejects non-integer money values", async () => {
    await expect(
      repo.createInvoice({
        customerId: "c",
        lines: [{ description: "x", quantity: 1, unitPrice: 12.5 }],
      }),
    ).rejects.toThrow(/integer number of cents/);
  });

  it("rejects zero-quantity lines", async () => {
    await expect(
      repo.createInvoice({
        customerId: "c",
        lines: [{ description: "x", quantity: 0, unitPrice: 100 }],
      }),
    ).rejects.toThrow(/quantity must be greater than 0/);
  });

  it("edits a draft and recomputes totals", async () => {
    const inv = await draft(repo);
    const next = await repo.updateInvoice(inv.id, {
      lines: [{ description: "Diagnostic", quantity: 1, unitPrice: 5000 }],
      tax: 0,
    });
    expect(next.subtotal).toBe(5000);
    expect(next.total).toBe(5000);
    expect(next.balance).toBe(5000);
  });

  it("numbers invoices sequentially", async () => {
    await draft(repo);
    const second = await draft(repo);
    expect(second.number).toBe("INV-0002");
  });
});

describe("FinanceRepository — issuing (snapshot principle)", () => {
  let repo: FinanceRepository;
  beforeEach(() => {
    repo = fresh();
  });

  it("issues an invoice and writes an immutable snapshot", async () => {
    const inv = await draft(repo);
    const issued = await repo.issueInvoice(inv.id);
    expect(issued.status).toBe("issued");
    expect(issued.issuedAt).toBeTypeOf("number");
    expect(issued.dueAt).toBeGreaterThan(issued.issuedAt!);

    const snaps = await repo.listSnapshots(inv.id);
    expect(snaps).toHaveLength(1);
    expect(snaps[0].invoice.total).toBe(issued.total);
    expect(Object.isFrozen(snaps[0].invoice)).toBe(true);
  });

  it("refuses to issue an empty or zero-total invoice", async () => {
    const empty = await repo.createInvoice({ customerId: "c" });
    await expect(repo.issueInvoice(empty.id)).rejects.toThrow(/at least one line/);
  });

  it("refuses to edit an issued invoice", async () => {
    const inv = await draft(repo);
    await repo.issueInvoice(inv.id);
    await expect(
      repo.updateInvoice(inv.id, { tax: 0 }),
    ).rejects.toThrow(/immutable/);
  });

  it("refuses to issue twice", async () => {
    const inv = await draft(repo);
    await repo.issueInvoice(inv.id);
    await expect(repo.issueInvoice(inv.id)).rejects.toThrow(/no longer be issued/);
  });

  it("snapshot totals survive later payment activity", async () => {
    const inv = await draft(repo);
    const issued = await repo.issueInvoice(inv.id);
    await repo.recordPayment(inv.id, { amount: 1000, method: "cash" });
    const snaps = await repo.listSnapshots(inv.id);
    expect(snaps[0].invoice.total).toBe(issued.total);
    expect(snaps[0].invoice.amountPaid).toBe(0);
  });
});

describe("FinanceRepository — payments", () => {
  let repo: FinanceRepository;
  beforeEach(() => {
    repo = fresh();
  });

  it("blocks payments on drafts", async () => {
    const inv = await draft(repo);
    await expect(
      repo.recordPayment(inv.id, { amount: 100, method: "cash" }),
    ).rejects.toThrow(/must be issued/);
  });

  it("records a partial payment", async () => {
    const inv = await repo.issueInvoice((await draft(repo)).id);
    await repo.recordPayment(inv.id, { amount: 1000, method: "card" });
    const after = await repo.getInvoice(inv.id);
    expect(after!.status).toBe("partially_paid");
    expect(after!.amountPaid).toBe(1000);
    expect(after!.balance).toBe(inv.total - 1000);
  });

  it("marks paid when the balance reaches zero", async () => {
    const inv = await repo.issueInvoice((await draft(repo)).id);
    await repo.recordPayment(inv.id, { amount: 1000, method: "cash" });
    await repo.recordPayment(inv.id, {
      amount: inv.total - 1000,
      method: "transfer",
    });
    const after = await repo.getInvoice(inv.id);
    expect(after!.status).toBe("paid");
    expect(after!.balance).toBe(0);
    expect(after!.paidAt).toBeTypeOf("number");
    expect(await repo.listPayments(inv.id)).toHaveLength(2);
  });

  it("rejects overpayment", async () => {
    const inv = await repo.issueInvoice((await draft(repo)).id);
    await expect(
      repo.recordPayment(inv.id, { amount: inv.total + 1, method: "cash" }),
    ).rejects.toThrow(/exceeds the outstanding balance/);
  });

  it("rejects zero / negative amounts and unknown methods", async () => {
    const inv = await repo.issueInvoice((await draft(repo)).id);
    await expect(
      repo.recordPayment(inv.id, { amount: 0, method: "cash" }),
    ).rejects.toThrow(/greater than zero/);
    await expect(
      repo.recordPayment(inv.id, { amount: -5, method: "cash" }),
    ).rejects.toThrow();
    await expect(
      repo.recordPayment(inv.id, {
        amount: 100,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        method: "crypto" as any,
      }),
    ).rejects.toThrow(/Invalid payment method/);
  });
});

describe("FinanceRepository — voiding", () => {
  let repo: FinanceRepository;
  beforeEach(() => {
    repo = fresh();
  });

  it("voids an issued invoice with a reason and zeroes the balance", async () => {
    const inv = await repo.issueInvoice((await draft(repo)).id);
    const voided = await repo.voidInvoice(inv.id, { reason: "Duplicate" });
    expect(voided.status).toBe("void");
    expect(voided.voidReason).toBe("Duplicate");
    expect(voided.balance).toBe(0);
  });

  it("requires a reason", async () => {
    const inv = await repo.issueInvoice((await draft(repo)).id);
    await expect(repo.voidInvoice(inv.id, { reason: "  " })).rejects.toThrow(
      /reason is required/,
    );
  });

  it("refuses to void a draft or void twice", async () => {
    const d = await draft(repo);
    await expect(repo.voidInvoice(d.id, { reason: "x" })).rejects.toThrow(
      /still a draft/,
    );
    const inv = await repo.issueInvoice(d.id);
    await repo.voidInvoice(inv.id, { reason: "x" });
    await expect(repo.voidInvoice(inv.id, { reason: "y" })).rejects.toThrow(
      /already void/,
    );
  });

  it("blocks payments on void invoices", async () => {
    const inv = await repo.issueInvoice((await draft(repo)).id);
    await repo.voidInvoice(inv.id, { reason: "x" });
    await expect(
      repo.recordPayment(inv.id, { amount: 100, method: "cash" }),
    ).rejects.toThrow(/is void/);
  });
});

describe("FinanceRepository — queries & persistence", () => {
  let repo: FinanceRepository;
  beforeEach(() => {
    repo = fresh();
  });

  it("filters by status, customer, and outstanding balance", async () => {
    const a = await draft(repo);
    await repo.createInvoice({ customerId: "cust-2", lines: LINES });
    await repo.issueInvoice(a.id);

    expect(await repo.listInvoices({ status: "issued" })).toHaveLength(1);
    expect(await repo.listInvoices({ customerId: "cust-2" })).toHaveLength(1);
    const outstanding = await repo.listInvoices({ outstandingOnly: true });
    expect(outstanding.map((i) => i.id)).toContain(a.id);
  });

  it("persists across repository instances", async () => {
    const inv = await draft(repo);
    await repo.issueInvoice(inv.id);
    const reloaded = createLocalFinanceRepository();
    const found = await reloaded.getInvoice(inv.id);
    expect(found?.status).toBe("issued");
    expect((await reloaded.listSnapshots(inv.id))).toHaveLength(1);
  });

  it("notifies subscribers on mutation", async () => {
    const spy = vi.fn();
    const unsub = repo.subscribe(spy);
    await draft(repo);
    expect(spy).toHaveBeenCalled();
    unsub();
  });
});

describe("FinanceRepository — activity events", () => {
  let repo: FinanceRepository;
  beforeEach(() => {
    repo = fresh();
  });

  it("emits immutable event names across the lifecycle", async () => {
    const spy = vi.spyOn(emitter, "emit");
    const inv = await repo.createInvoice({ customerId: "c", lines: LINES });
    await repo.issueInvoice(inv.id);
    await repo.recordPayment(inv.id, { amount: 100, method: "cash" });

    const types = spy.mock.calls.map((c) => c[0].type);
    expect(types).toContain(FINANCE_EVENTS.invoiceCreated);
    expect(types).toContain(FINANCE_EVENTS.invoiceIssued);
    expect(types).toContain(FINANCE_EVENTS.paymentRecorded);
    expect(types).toContain(FINANCE_EVENTS.invoicePartiallyPaid);
    spy.mockRestore();
  });
});

describe("Data registry — swap safety", () => {
  beforeEach(() => clearRepository(FINANCE_REPOSITORY));

  it("returns whichever implementation is registered", () => {
    const repoA = createLocalFinanceRepository();
    const repoB = createLocalFinanceRepository();
    registerRepository(FINANCE_REPOSITORY, repoA);
    expect(getRepository<FinanceRepository>(FINANCE_REPOSITORY)).toBe(repoA);
    registerRepository(FINANCE_REPOSITORY, repoB);
    expect(getRepository<FinanceRepository>(FINANCE_REPOSITORY)).toBe(repoB);
  });
});
