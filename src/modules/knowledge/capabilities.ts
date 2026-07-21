// Knowledge module capabilities.
// - knowledge.read / knowledge.write are also reserved in
//   src/core/roles/reserved-capabilities.ts so they exist from bootstrap
//   even before this module registers. Registering again here is idempotent
//   (see registerCapability).
// - knowledge.version and knowledge.approve are added in Phase 3.

import type { Capability } from "@/core/roles/roles";

export const KNOWLEDGE_CAPABILITIES: Capability[] = [
  {
    id: "knowledge.read",
    description: "Read knowledge documents, versions, and links.",
    ownerModuleId: "knowledge",
  },
  {
    id: "knowledge.write",
    description:
      "Create or edit knowledge documents (produces a new version on edit).",
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
];
