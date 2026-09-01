import { afterEach, describe, expect, it } from "vitest";
import { clearRepository, registerRepository } from "./registry";
import { ReferenceIntegrityError, verifyReference, verifyReferences } from "./references";

const KEY = "test.customerRepository";

afterEach(() => clearRepository());

describe("referential integrity", () => {
  it("passes when the referenced id resolves", async () => {
    registerRepository(KEY, { get: async (id: string) => ({ id }) });
    await expect(
      verifyReference({ repository: KEY, field: "customerId", id: "c1", entity: "Customer" }),
    ).resolves.toBe("ok");
  });

  it("throws when the id is present but resolves to nothing", async () => {
    registerRepository(KEY, { get: async () => undefined });
    await expect(
      verifyReference({ repository: KEY, field: "customerId", id: "ghost", entity: "Customer" }),
    ).rejects.toBeInstanceOf(ReferenceIntegrityError);
  });

  it("SKIPS the check when the owning module is not registered", async () => {
    // Modules must stay independently bootstrappable; an unregistered
    // module is not an integrity failure.
    await expect(
      verifyReference({ repository: KEY, field: "customerId", id: "c1", entity: "Customer" }),
    ).resolves.toBe("skipped");
  });

  it("treats a missing optional id as fine and a missing required id as an error", async () => {
    registerRepository(KEY, { get: async () => undefined });
    await expect(
      verifyReference({ repository: KEY, field: "vehicleId", id: undefined, entity: "Vehicle" }),
    ).resolves.toBe("ok");
    await expect(
      verifyReference({
        repository: KEY,
        field: "customerId",
        id: "  ",
        entity: "Customer",
        required: true,
      }),
    ).rejects.toThrow(/required/);
  });

  it("supports a custom lookup for repositories without a bare get()", async () => {
    registerRepository(KEY, { getQuote: async (id: string) => ({ id }) });
    await expect(
      verifyReferences([
        {
          repository: KEY,
          field: "quoteId",
          id: "q1",
          entity: "Quote",
          lookup: (repo, id) =>
            (repo as { getQuote(id: string): Promise<unknown> }).getQuote(id),
        },
      ]),
    ).resolves.toBeUndefined();
  });
});
