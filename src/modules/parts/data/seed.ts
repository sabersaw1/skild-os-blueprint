// Dev seed for the Parts module.
//
// Seeds SUPPLIER RECORDS ONLY — plain metadata rows. No API clients, no
// credentials, no integrations. Runs through the repository (never direct
// storage writes) and is idempotent by supplier name.

import type { PartsRepository } from "./repository";
import type { CreateSupplierInput } from "./schemas";

export const DEFAULT_SUPPLIERS: CreateSupplierInput[] = [
  { name: "eBay", type: "marketplace", website: "https://www.ebay.com" },
  { name: "Amazon", type: "marketplace", website: "https://www.amazon.com" },
  { name: "AutoZone", type: "parts_store", website: "https://www.autozone.com" },
  {
    name: "Advance Auto Parts",
    type: "parts_store",
    website: "https://shop.advanceautoparts.com",
  },
  {
    name: "O'Reilly Auto Parts",
    type: "parts_store",
    website: "https://www.oreillyauto.com",
  },
];

/** Idempotent: only creates suppliers whose name is not already present. */
export async function seedPartSuppliers(
  repo: PartsRepository,
): Promise<number> {
  const existing = await repo.listSuppliers();
  const known = new Set(existing.map((s) => s.name.toLowerCase()));
  let created = 0;
  for (const input of DEFAULT_SUPPLIERS) {
    if (known.has(input.name.toLowerCase())) continue;
    await repo.createSupplier(input);
    created += 1;
  }
  return created;
}
