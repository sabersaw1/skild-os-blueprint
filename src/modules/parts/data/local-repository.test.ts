// Unit + integration tests for the Parts local repository.
// Mirrors the Jobs / Quotes test setup: in-memory localStorage polyfill
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

import { createLocalPartsRepository } from "./local-repository";
import { PART_EVENTS } from "../activity";
import { seedPartSuppliers } from "./seed";
import {
  computePurchaseTotals,
  formatCents,
  lineTotalCents,
  toCents,
} from "./money";
import * as emitter from "@/core/activity/emitter";
import {
  clearRepository,
  getRepository,
  registerRepository,
} from "@/core/data/registry";
import { PARTS_REPOSITORY, type PartsRepository } from "./repository";

function fresh(): PartsRepository {
  (
    globalThis as unknown as { localStorage: MemoryStorage }
  ).localStorage.clear();
  return createLocalPartsRepository();
}

async function supplier(repo: PartsRepository) {
  return repo.createSupplier({ name: "eBay", type: "marketplace" });
}

describe("money — integer cents", () => {
  it("converts dollars to integer cents", () => {
    expect(toCents("12.34")).toBe(1234);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents("")).toBe(0);
  });

  it("computes line totals as integers", () => {
    expect(lineTotalCents(3, 1999)).toBe(5997);
  });

  it("computes purchase totals from cents", () => {
    const t = computePurchaseTotals(
      [{ lineTotal: 1000 }, { lineTotal: 2500 }],
      599,
      310,
    );
    expect(t.subtotal).toBe(3500);
    expect(t.total).toBe(4409);
  });

  it("formats cents as USD", () => {
    expect(formatCents(4409)).toContain("44.09");
  });
});

describe("PartsRepository — parts CRUD", () => {
  let repo: PartsRepository;
  beforeEach(() => {
    repo = fresh();
  });

  it("creates a part with defaults and a UUID id", async () => {
    const part = await repo.createPart({ name: "Front brake pads" });
    expect(part.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(part.status).toBe("active");
    expect(part.createdAt).toBeGreaterThan(0);
  });

  it("rejects an empty name", async () => {
    await expect(repo.createPart({ name: "   " })).rejects.toThrow(
      /name is required/i,
    );
  });

  it("updates a part and bumps updatedAt", async () => {
    const part = await repo.createPart({ name: "Rotor" });
    const updated = await repo.updatePart(part.id, { brand: "Brembo" });
    expect(updated.brand).toBe("Brembo");
    expect(updated.updatedAt).toBeGreaterThanOrEqual(part.updatedAt);
  });

  it("archives a part", async () => {
    const part = await repo.createPart({ name: "Oil filter" });
    const archived = await repo.archivePart(part.id);
    expect(archived.status).toBe("archived");
  });

  it("filters parts by search, brand, and status", async () => {
    await repo.createPart({ name: "Brake pads", brand: "Brembo" });
    await repo.createPart({ name: "Cabin filter", brand: "Mann" });
    const search = await repo.listParts({ search: "brake" });
    expect(search.items).toHaveLength(1);
    const brand = await repo.listParts({ brand: "Mann" });
    expect(brand.items[0]?.name).toBe("Cabin filter");
    const active = await repo.listParts({ status: "active" });
    expect(active.items).toHaveLength(2);
  });

  it("persists across repository instances", async () => {
    await repo.createPart({ name: "Spark plug" });
    const second = createLocalPartsRepository();
    const list = await second.listParts();
    expect(list.items).toHaveLength(1);
  });
});

describe("PartsRepository — suppliers", () => {
  let repo: PartsRepository;
  beforeEach(() => {
    repo = fresh();
  });

  it("creates and updates a supplier", async () => {
    const s = await repo.createSupplier({ name: "AutoZone", type: "parts_store" });
    expect(s.active).toBe(true);
    const updated = await repo.updateSupplier(s.id, { active: false });
    expect(updated.active).toBe(false);
  });

  it("rejects an invalid supplier type", async () => {
    await expect(
      repo.createSupplier({
        name: "X",
        type: "bogus" as never,
      }),
    ).rejects.toThrow(/invalid supplier type/i);
  });

  it("seeds default suppliers idempotently", async () => {
    const first = await seedPartSuppliers(repo);
    expect(first).toBeGreaterThan(0);
    const second = await seedPartSuppliers(repo);
    expect(second).toBe(0);
  });
});

describe("PartsRepository — purchases", () => {
  let repo: PartsRepository;
  beforeEach(() => {
    repo = fresh();
  });

  it("creates a purchase with lines atomically and derives totals", async () => {
    const s = await supplier(repo);
    const purchase = await repo.createPurchase({
      supplierId: s.id,
      shipping: 500,
      tax: 250,
      lines: [
        { description: "Pads", quantity: 2, unitCost: 4599 },
        { description: "Rotors", quantity: 2, unitCost: 8999 },
      ],
    });
    expect(purchase.subtotal).toBe(2 * 4599 + 2 * 8999);
    expect(purchase.total).toBe(purchase.subtotal + 500 + 250);
    const lines = await repo.listPurchaseLines(purchase.id);
    expect(lines).toHaveLength(2);
    expect(lines[0]?.lineTotal).toBe(9198);
  });

  it("recalculates totals when a line is added", async () => {
    const s = await supplier(repo);
    const purchase = await repo.createPurchase({ supplierId: s.id });
    expect(purchase.total).toBe(0);
    await repo.addPurchaseLine(purchase.id, {
      description: "Filter",
      quantity: 1,
      unitCost: 1299,
    });
    const updated = await repo.getPurchase(purchase.id);
    expect(updated?.subtotal).toBe(1299);
    expect(updated?.total).toBe(1299);
  });

  it("rejects non-integer money values", async () => {
    const s = await supplier(repo);
    await expect(
      repo.createPurchase({ supplierId: s.id, shipping: 5.5 }),
    ).rejects.toThrow(/integer/i);
  });

  it("rejects an unknown supplier", async () => {
    await expect(
      repo.createPurchase({ supplierId: "nope" }),
    ).rejects.toThrow(/supplier/i);
  });

  it("filters purchases by supplier and status", async () => {
    const s = await supplier(repo);
    const p = await repo.createPurchase({ supplierId: s.id });
    await repo.updatePurchase(p.id, { status: "received" });
    const received = await repo.listPurchases({ status: "received" });
    expect(received.items).toHaveLength(1);
    const bySupplier = await repo.listPurchases({ supplierId: s.id });
    expect(bySupplier.items).toHaveLength(1);
  });
});

describe("PartsRepository — usage and vehicle references", () => {
  let repo: PartsRepository;
  beforeEach(() => {
    repo = fresh();
  });

  it("records usage with derived total cost", async () => {
    const part = await repo.createPart({ name: "Pads" });
    const usage = await repo.recordUsage({
      partId: part.id,
      vehicleId: "veh-1",
      quantity: 2,
      unitCost: 4599,
    });
    expect(usage.totalCost).toBe(9198);
    const list = await repo.listUsage({ partId: part.id });
    expect(list).toHaveLength(1);
  });

  it("rejects usage for an unknown part", async () => {
    await expect(
      repo.recordUsage({
        partId: "missing",
        vehicleId: "veh-1",
        quantity: 1,
        unitCost: 100,
      }),
    ).rejects.toThrow(/part/i);
  });

  it("adds vehicle references", async () => {
    const part = await repo.createPart({ name: "Pads" });
    await repo.addVehicleReference({ partId: part.id, vehicleId: "veh-9" });
    const refs = await repo.listVehicleReferences(part.id);
    expect(refs).toHaveLength(1);
    expect(refs[0]?.vehicleId).toBe("veh-9");
  });
});

describe("PartsRepository — activity events", () => {
  let repo: PartsRepository;
  beforeEach(() => {
    repo = fresh();
  });

  it("emits validate → persist → emit sequence for the full flow", async () => {
    const spy = vi.spyOn(emitter, "emit");
    const s = await repo.createSupplier({ name: "eBay", type: "marketplace" });
    const part = await repo.createPart({ name: "Pads" });
    const purchase = await repo.createPurchase({
      supplierId: s.id,
      lines: [{ description: "Pads", quantity: 1, unitCost: 4599 }],
    });
    await repo.recordUsage({
      partId: part.id,
      vehicleId: "veh-1",
      jobId: "job-1",
      quantity: 1,
      unitCost: 4599,
    });

    const types = spy.mock.calls.map((c) => c[0].type);
    expect(types).toContain(PART_EVENTS.supplierCreated);
    expect(types).toContain(PART_EVENTS.partCreated);
    expect(types).toContain(PART_EVENTS.purchaseCreated);
    expect(types).toContain(PART_EVENTS.usageRecorded);
    expect(purchase.total).toBe(4599);
    spy.mockRestore();
  });

  it("does not emit when validation fails", async () => {
    const spy = vi.spyOn(emitter, "emit");
    await expect(repo.createPart({ name: "" })).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("PartsRepository — registry swap", () => {
  it("serves a fake implementation registered under the same key", async () => {
    clearRepository(PARTS_REPOSITORY);
    const fake = {
      listParts: async () => ({ items: [] }),
    } as unknown as PartsRepository;
    registerRepository(PARTS_REPOSITORY, fake);
    const resolved = getRepository<PartsRepository>(PARTS_REPOSITORY);
    expect(await resolved.listParts()).toEqual({ items: [] });
    clearRepository(PARTS_REPOSITORY);
  });
});

describe("Cross-module flow — part → purchase → usage on vehicle/job", () => {
  it("links a purchased part to a vehicle and job by ID only", async () => {
    const repo = fresh();
    const s = await supplier(repo);
    const part = await repo.createPart({ name: "Pads", partNumber: "BP-1" });
    const purchase = await repo.createPurchase({
      supplierId: s.id,
      lines: [
        { description: "Pads", partId: part.id, quantity: 1, unitCost: 4599 },
      ],
    });
    const [line] = await repo.listPurchaseLines(purchase.id);
    await repo.recordUsage({
      partId: part.id,
      vehicleId: "veh-1",
      jobId: "job-1",
      purchaseLineId: line!.id,
      quantity: 1,
      unitCost: line!.unitCost,
    });
    const usage = await repo.listUsage({ jobId: "job-1" });
    expect(usage).toHaveLength(1);
    expect(usage[0]?.totalCost).toBe(4599);
  });
});
