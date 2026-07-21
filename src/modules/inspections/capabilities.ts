// Inspections module capabilities. Registered via the manifest at bootstrap.
// Owner role holds "*" so these are additive/documentary in Phase 4.

import type { Capability } from "@/core/roles/roles";

export const INSPECTIONS_CAPABILITIES: Capability[] = [
  {
    id: "inspections.read",
    description: "View inspections, findings, and inspection templates.",
    ownerModuleId: "inspections",
  },
  {
    id: "inspections.write",
    description: "Create or edit inspections and findings.",
    ownerModuleId: "inspections",
  },
  {
    id: "inspections.templates.write",
    description: "Create or edit inspection templates.",
    ownerModuleId: "inspections",
  },
  {
    id: "inspections.photos.write",
    description: "Queue inspection photos through the Upload Queue.",
    ownerModuleId: "inspections",
  },
];
