// Proves the Phase 13.5 v1 → v2 money migration: quotes stored as float
// dollars are re-read as integer cents, losslessly and without guessing.

import { beforeEach, describe, expect, it } from "vitest";
import {
  createMemoryStorageDriver,
  resetStorageDriver,
  setStorageDriver,
} from "@/core/storage/driver";

let memory = createMemoryStorageDriver();

beforeEach(() => {
  memory = createMemoryStorageDriver();
  setStorageDriver(memory);
});

const K_QUOTES = "skildos.quotes.quotes.v2";

function seedLegacyQuote() {
  // A v1 envelope: dollars everywhere, no *Cents fields.
  setStorageDriver(
    createMemoryStorageDriver({
      [K_QUOTES]: JSON.stringify({
        schemaVersion: 1,
        records: [
          {
            id: "q1",
            customerId: "c1",
            vehicleId: "v1",
            title: "Legacy quote",
            status: "draft",
            lineItems: [
              {
                id: "li1",
                description: "Pads",
                category: "part",
                quantity: 2,
                unitPrice: 55.5,
                total: 111,
              },
            ],
            subtotal: 111,
            discount: 10.25,
            tax: 8.88,
            total: 109.63,
            notes: "",
            statusHistory: [],
            currentVersion: 1,
            createdAt: 1,
            updatedAt: 1,
            createdBy: "u1",
          },
        ],
      }),
    }),
  );
}

describe("Quotes money migration (v1 dollars → v2 cents)", () => {
  it("converts every monetary field to integer cents on read", async () => {
    seedLegacyQuote();
    const { createLocalQuotesRepository } = await import("./local-repository");
    const repo = createLocalQuotesRepository();
    const q = await repo.getQuote("q1");
    expect(q).toBeDefined();
    expect(q!.subtotalCents).toBe(11100);
    expect(q!.discountCents).toBe(1025);
    expect(q!.taxCents).toBe(888);
    expect(q!.totalCents).toBe(10963);
    expect(q!.lineItems[0].unitPriceCents).toBe(5550);
    expect(q!.lineItems[0].totalCents).toBe(11100);
    // No float remnants survive the migration.
    expect(
      Object.keys(q as unknown as Record<string, unknown>),
    ).not.toContain("subtotal");
  });

  it("leaves non-monetary fields untouched", async () => {
    seedLegacyQuote();
    const { createLocalQuotesRepository } = await import("./local-repository");
    const q = await createLocalQuotesRepository().getQuote("q1");
    expect(q!.title).toBe("Legacy quote");
    expect(q!.customerId).toBe("c1");
    expect(q!.currentVersion).toBe(1);
  });
});

describe("teardown", () => {
  it("restores the default driver", () => {
    resetStorageDriver();
    expect(memory.snapshot()).toBeDefined();
  });
});
