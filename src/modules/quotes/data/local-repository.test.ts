// Unit + integration tests for the Quotes local repository.
// Mirrors the Inspections test setup: minimal in-memory localStorage
// polyfill installed before importing the repository module.

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- Minimal localStorage polyfill for node env ------------------------
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

// Now import modules under test (after the polyfill).
import { createLocalQuotesRepository } from "./local-repository";
import { QUOTE_EVENTS } from "../activity";
import * as emitter from "@/core/activity/emitter";
import type { QuotesRepository } from "./repository";
import {
  clearRepository,
  getRepository,
  registerRepository,
} from "@/core/data/registry";
import { QUOTES_REPOSITORY } from "./repository";

function fresh(): QuotesRepository {
  (
    globalThis as unknown as { localStorage: MemoryStorage }
  ).localStorage.clear();
  return createLocalQuotesRepository();
}

const baseInput = {
  customerId: "cust-1",
  vehicleId: "veh-1",
  title: "Front brake replacement",
};

describe("QuotesRepository — CRUD", () => {
  it("creates a quote with default draft status, seeds v1, and emits both events", async () => {
    const spy = vi.spyOn(emitter, "emit");
    const repo = fresh();
    spy.mockClear();
    const q = await repo.createQuote({
      ...baseInput,
      lineItems: [
        {
          description: "Front pads",
          category: "part",
          quantity: 2,
          unitPriceCents: 5500,
        },
        {
          description: "Labor",
          category: "labor",
          quantity: 1.5,
          unitPriceCents: 12000,
          laborHours: 1.5,
        },
      ],
      taxCents: 2000,
      discountCents: 1000,
    });
    expect(q.status).toBe("draft");
    expect(q.currentVersion).toBe(1);
    expect(q.lineItems).toHaveLength(2);
    expect(q.subtotalCents).toBe(2 * 5500 + Math.round(1.5 * 12000));
    expect(q.totalCents).toBe(q.subtotalCents - 1000 + 2000);

    const versions = await repo.listVersions(q.id);
    expect(versions).toHaveLength(1);
    expect(versions[0].versionNumber).toBe(1);
    expect(versions[0].snapshot.totalCents).toBe(q.totalCents);

    const types = spy.mock.calls.map(
      (c: unknown[]) => (c[0] as { type: string }).type,
    );
    expect(types).toEqual([
      QUOTE_EVENTS.created,
      QUOTE_EVENTS.versionCreated,
    ]);
  });

  it("rejects missing customerId / vehicleId / title", async () => {
    const repo = fresh();
    await expect(
      repo.createQuote({ ...baseInput, customerId: "" }),
    ).rejects.toThrow(/customerId/);
    await expect(
      repo.createQuote({ ...baseInput, vehicleId: "" }),
    ).rejects.toThrow(/vehicleId/);
    await expect(
      repo.createQuote({ ...baseInput, title: "" }),
    ).rejects.toThrow(/title/i);
  });

  it("rejects invalid line item shapes", async () => {
    const repo = fresh();
    await expect(
      repo.createQuote({
        ...baseInput,
        lineItems: [
          {
            description: "",
            category: "labor",
            quantity: 1,
            unitPriceCents: 1000,
          },
        ],
      }),
    ).rejects.toThrow(/description/);
    await expect(
      repo.createQuote({
        ...baseInput,
        lineItems: [
          {
            description: "x",
            category: "labor",
            quantity: -1,
            unitPriceCents: 1000,
          },
        ],
      }),
    ).rejects.toThrow(/quantity/);
  });
});

describe("QuotesRepository — versioning", () => {
  it("update creates a new immutable version and increments currentVersion", async () => {
    const spy = vi.spyOn(emitter, "emit");
    const repo = fresh();
    const q = await repo.createQuote({
      ...baseInput,
      lineItems: [
        {
          description: "Pads",
          category: "part",
          quantity: 1,
          unitPriceCents: 4000,
        },
      ],
    });
    spy.mockClear();
    const updated = await repo.updateQuote(q.id, {
      title: "Front brake overhaul",
      lineItems: [
        {
          description: "Pads",
          category: "part",
          quantity: 2,
          unitPriceCents: 4500,
        },
        {
          description: "Rotor",
          category: "part",
          quantity: 2,
          unitPriceCents: 8000,
        },
      ],
      changeReason: "Customer added rotors",
    });
    expect(updated.currentVersion).toBe(2);
    expect(updated.title).toBe("Front brake overhaul");
    expect(updated.totalCents).toBe(2 * 4500 + 2 * 8000);

    const versions = await repo.listVersions(q.id);
    expect(versions).toHaveLength(2);
    expect(versions[1].snapshot.title).toBe("Front brake overhaul");
    // v1 snapshot is immutable — still shows original title.
    expect(versions[0].snapshot.title).toBe("Front brake replacement");

    const types = spy.mock.calls.map(
      (c: unknown[]) => (c[0] as { type: string }).type,
    );
    expect(types).toEqual([
      QUOTE_EVENTS.updated,
      QUOTE_EVENTS.versionCreated,
    ]);
  });

  it("requires a changeReason on update", async () => {
    const repo = fresh();
    const q = await repo.createQuote(baseInput);
    await expect(
      // @ts-expect-error missing changeReason
      repo.updateQuote(q.id, { title: "x" }),
    ).rejects.toThrow(/changeReason/);
  });

  it("blocks updates on non-draft quotes", async () => {
    const repo = fresh();
    const q = await repo.createQuote(baseInput);
    await repo.sendQuote(q.id);
    await expect(
      repo.updateQuote(q.id, { title: "x", changeReason: "y" }),
    ).rejects.toThrow(/draft/);
  });
});

describe("QuotesRepository — status transitions", () => {
  it("draft → sent → approved emits the right events", async () => {
    const spy = vi.spyOn(emitter, "emit");
    const repo = fresh();
    const q = await repo.createQuote(baseInput);
    spy.mockClear();
    const sent = await repo.sendQuote(q.id, { reason: "emailed" });
    expect(sent.status).toBe("sent");
    const approved = await repo.approveQuote(q.id);
    expect(approved.status).toBe("approved");
    expect(approved.statusHistory).toHaveLength(2);
    const types = spy.mock.calls.map(
      (c: unknown[]) => (c[0] as { type: string }).type,
    );
    expect(types).toEqual([QUOTE_EVENTS.sent, QUOTE_EVENTS.approved]);
  });

  it("rejects illegal transitions", async () => {
    const repo = fresh();
    const q = await repo.createQuote(baseInput);
    // draft → approved is illegal (must go through sent)
    await expect(repo.approveQuote(q.id)).rejects.toThrow(/transition/);
    await expect(repo.expireQuote(q.id)).rejects.toThrow(/transition/);
  });

  it("declined and expired terminate the flow", async () => {
    const repo = fresh();
    const q1 = await repo.createQuote(baseInput);
    await repo.sendQuote(q1.id);
    await repo.declineQuote(q1.id);
    await expect(repo.approveQuote(q1.id)).rejects.toThrow(/transition/);

    const q2 = await repo.createQuote({ ...baseInput, title: "b" });
    await repo.sendQuote(q2.id);
    await repo.expireQuote(q2.id);
    await expect(repo.sendQuote(q2.id)).rejects.toThrow(/transition/);
  });
});

describe("QuotesRepository — totals", () => {
  it("computes subtotal / discount / tax / total in integer cents", async () => {
    const repo = fresh();
    const q = await repo.createQuote({
      ...baseInput,
      lineItems: [
        {
          description: "A",
          category: "part",
          quantity: 3,
          unitPriceCents: 1000,
        },
        {
          description: "B",
          category: "fee",
          quantity: 1,
          unitPriceCents: 1,
        },
      ],
      discountCents: 1,
      taxCents: 100,
    });
    // 3 * 1000c = 3000c, plus 1 * 1c = 3001c subtotal. No float drift.
    expect(q.subtotalCents).toBe(3001);
    expect(q.discountCents).toBe(1);
    expect(q.taxCents).toBe(100);
    expect(q.totalCents).toBe(3001 - 1 + 100);
  });
});

describe("QuotesRepository — query", () => {
  it("filters by customerId / vehicleId / inspectionId / status and searches title", async () => {
    const repo = fresh();
    const a = await repo.createQuote({
      ...baseInput,
      title: "Brake job",
    });
    const b = await repo.createQuote({
      customerId: "cust-2",
      vehicleId: "veh-2",
      inspectionId: "insp-9",
      title: "Oil change",
    });
    await repo.sendQuote(b.id);

    expect((await repo.listQuotes({ customerId: "cust-1" })).map((x) => x.id))
      .toEqual([a.id]);
    expect((await repo.listQuotes({ vehicleId: "veh-2" })).map((x) => x.id))
      .toEqual([b.id]);
    expect((await repo.listQuotes({ inspectionId: "insp-9" })).map((x) => x.id))
      .toEqual([b.id]);
    expect((await repo.listQuotes({ status: "sent" })).map((x) => x.id))
      .toEqual([b.id]);
    expect((await repo.listQuotes({ search: "oil" })).map((x) => x.id))
      .toEqual([b.id]);
  });
});

describe("QuotesRepository — registry swap", () => {
  beforeEach(() => clearRepository(QUOTES_REPOSITORY));

  it("registry consumers see whatever repo is registered", async () => {
    (
      globalThis as unknown as { localStorage: MemoryStorage }
    ).localStorage.clear();
    const repoA = createLocalQuotesRepository();
    registerRepository(QUOTES_REPOSITORY, repoA);
    const looked = getRepository<QuotesRepository>(QUOTES_REPOSITORY);
    expect(looked).toBe(repoA);

    const repoB = createLocalQuotesRepository();
    registerRepository(QUOTES_REPOSITORY, repoB);
    expect(getRepository<QuotesRepository>(QUOTES_REPOSITORY)).toBe(repoB);
    expect(getRepository<QuotesRepository>(QUOTES_REPOSITORY)).not.toBe(repoA);
  });
});

describe("Quotes — full CRM → Vehicle → Inspection → Quote flow", () => {
  it("integrates repository state and activity sequence end-to-end", async () => {
    const spy = vi.spyOn(emitter, "emit");
    const repo = fresh();
    spy.mockClear();

    // Cross-module identifiers arrive by ID only (Quotes never imports
    // CRM/Vehicles/Inspections repository implementations).
    const customerId = "cust-integration";
    const vehicleId = "veh-integration";
    const inspectionId = "insp-integration";

    const quote = await repo.createQuote({
      customerId,
      vehicleId,
      inspectionId,
      title: "Post-inspection quote",
      lineItems: [
        {
          description: "Front pads",
          category: "part",
          quantity: 2,
          unitPriceCents: 4500,
        },
      ],
      taxCents: 1000,
    });
    expect(quote.inspectionId).toBe(inspectionId);
    expect(quote.totalCents).toBe(10000);

    await repo.updateQuote(quote.id, {
      lineItems: [
        {
          description: "Front pads",
          category: "part",
          quantity: 2,
          unitPriceCents: 4500,
        },
        {
          description: "Rotor",
          category: "part",
          quantity: 2,
          unitPriceCents: 8000,
        },
      ],
      taxCents: 1000,
      changeReason: "Added rotors",
    });
    const sent = await repo.sendQuote(quote.id, { reason: "emailed PDF" });
    expect(sent.status).toBe("sent");
    const approved = await repo.approveQuote(quote.id);
    expect(approved.status).toBe("approved");

    const versions = await repo.listVersions(quote.id);
    expect(versions.map((v) => v.versionNumber)).toEqual([1, 2]);

    const stored = await repo.getQuote(quote.id);
    expect(stored?.customerId).toBe(customerId);
    expect(stored?.vehicleId).toBe(vehicleId);
    expect(stored?.inspectionId).toBe(inspectionId);

    const types = spy.mock.calls.map(
      (c: unknown[]) => (c[0] as { type: string }).type,
    );
    expect(types).toEqual([
      QUOTE_EVENTS.created,
      QUOTE_EVENTS.versionCreated,
      QUOTE_EVENTS.updated,
      QUOTE_EVENTS.versionCreated,
      QUOTE_EVENTS.sent,
      QUOTE_EVENTS.approved,
    ]);
  });
});
