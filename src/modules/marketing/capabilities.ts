// Marketing + Lead Machine capabilities (Phase 11).
//
// Capability-based only — never role names (ADR-003). The split between
// `write`, `approve`, and `publish` is the durable human-control boundary:
// a future automation agent can be granted observation and preparation
// rights while remaining structurally unable to publish anything.

import type { Capability } from "@/core/roles/roles";

export const MARKETING_CAPABILITIES: Capability[] = [
  {
    id: "leads.read",
    description: "View leads, their lifecycle state, and attribution.",
    ownerModuleId: "marketing",
  },
  {
    id: "leads.write",
    description:
      "Create and update leads, move lifecycle state, and record conversions.",
    ownerModuleId: "marketing",
  },
  {
    id: "marketing.read",
    description:
      "View marketing opportunities, actions, and performance intelligence.",
    ownerModuleId: "marketing",
  },
  {
    id: "marketing.write",
    description:
      "Record marketing opportunities, recommend actions, and ingest measured performance records.",
    ownerModuleId: "marketing",
  },
  {
    id: "marketing.approve",
    description:
      "Approve a marketing opportunity or action for execution. Human review boundary.",
    ownerModuleId: "marketing",
  },
  {
    id: "marketing.publish",
    description:
      "Mark a public-facing marketing action as executed. Phase 11 publishes nothing itself.",
    ownerModuleId: "marketing",
  },
];
