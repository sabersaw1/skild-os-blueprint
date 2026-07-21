// Quotes module capabilities. Registered via the manifest at bootstrap.
// Owner role holds "*" so gating is additive/documentary in Phase 5.

import type { Capability } from "@/core/roles/roles";

export const QUOTES_CAPABILITIES: Capability[] = [
  {
    id: "quotes.read",
    description: "View quotes, versions, and status history.",
    ownerModuleId: "quotes",
  },
  {
    id: "quotes.write",
    description: "Create or edit quote drafts and line items.",
    ownerModuleId: "quotes",
  },
  {
    id: "quotes.version",
    description: "Create a new immutable quote version.",
    ownerModuleId: "quotes",
  },
  {
    id: "quotes.approve",
    description:
      "Transition a quote to sent / approved / declined / expired status.",
    ownerModuleId: "quotes",
  },
];
