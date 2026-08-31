// Parts module capabilities. Registered via the manifest at bootstrap.
// Owner role holds "*" so gating is additive/documentary in Phase 7.

import type { Capability } from "@/core/roles/roles";

export const PARTS_CAPABILITIES: Capability[] = [
  {
    id: "parts.read",
    description: "View parts, suppliers, purchases, and usage history.",
    ownerModuleId: "parts",
  },
  {
    id: "parts.write",
    description: "Create, edit, or archive part catalog records.",
    ownerModuleId: "parts",
  },
  {
    id: "parts.purchase.write",
    description: "Record purchases, purchase lines, and receipt references.",
    ownerModuleId: "parts",
  },
  {
    id: "parts.usage.write",
    description: "Record parts used on a vehicle or job.",
    ownerModuleId: "parts",
  },
  {
    id: "parts.suppliers.write",
    description: "Create or edit supplier records.",
    ownerModuleId: "parts",
  },
];
