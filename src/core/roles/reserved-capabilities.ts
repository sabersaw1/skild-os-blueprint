// Reserved capability names.
//
// These IDs are registered up front so that future modules (Knowledge System,
// AI, System Administration) inherit consistent naming from day one. The
// Owner role already grants everything (`capabilityIds: "*"`), so reserving
// names has no behavioral effect today — but it guarantees:
//
//   * Modules cannot accidentally squat on the same ID with a different meaning.
//   * The capability catalog visible in Settings → Roles is accurate from Phase 1.5.
//   * When Phase 3 (Knowledge) and Phase 5 (AI) land, existing UI/tests
//     can already reference these IDs.
//
// Add new reservations here. Never rename a reserved capability — deprecate
// and add a new one.

import { registerCapability } from "./roles";

export const RESERVED_CAPABILITIES = [
  {
    id: "knowledge.read",
    description: "Read SOPs, pricing rules, and brand-voice entries.",
    ownerModuleId: "knowledge",
  },
  {
    id: "knowledge.write",
    description: "Create or edit SOPs, pricing rules, and brand-voice entries.",
    ownerModuleId: "knowledge",
  },
  {
    id: "knowledge.version",
    description: "View and restore knowledge document versions.",
    ownerModuleId: "knowledge",
  },
  {
    id: "knowledge.approve",
    description:
      "Approve knowledge changes that require approval (e.g. pricing rules).",
    ownerModuleId: "knowledge",
  },
  {
    id: "ai.read",
    description: "View AI outputs, suggestions, and reasoning traces.",
    ownerModuleId: "ai",
  },
  {
    id: "ai.propose",
    description: "Allow AI to draft actions (quotes, messages, plans) for review.",
    ownerModuleId: "ai",
  },
  {
    id: "ai.approve",
    description:
      "Approve AI-proposed actions so they may be executed by the system.",
    ownerModuleId: "ai",
  },
  {
    id: "system.admin",
    description:
      "System administration: manage roles, integrations, and destructive actions.",
    ownerModuleId: "system",
  },
] as const;

export function registerReservedCapabilities() {
  for (const cap of RESERVED_CAPABILITIES) {
    registerCapability({ ...cap });
  }
}
