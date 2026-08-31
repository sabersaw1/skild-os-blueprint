// Finance module capabilities. Registered via the manifest at bootstrap.
// Owner role holds "*" so gating is additive/documentary in Phase 8.

import type { Capability } from "@/core/roles/roles";

export const FINANCE_CAPABILITIES: Capability[] = [
  {
    id: "finance.read",
    description: "View invoices, payments, and balances.",
    ownerModuleId: "finance",
  },
  {
    id: "finance.invoice.write",
    description: "Create and edit DRAFT invoices.",
    ownerModuleId: "finance",
  },
  {
    id: "finance.invoice.issue",
    description: "Issue an invoice, freezing it as an immutable record.",
    ownerModuleId: "finance",
  },
  {
    id: "finance.invoice.void",
    description: "Void an issued invoice with a recorded reason.",
    ownerModuleId: "finance",
  },
  {
    id: "finance.payment.write",
    description: "Record payments against issued invoices.",
    ownerModuleId: "finance",
  },
];
