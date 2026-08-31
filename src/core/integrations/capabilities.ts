// Integration capabilities. Provider-agnostic on purpose — there is no
// "gmail.connect" capability, only "integrations.connect". Future agents
// must operate through these capabilities, never through raw credentials.

import type { Capability } from "@/core/roles/roles";

export const INTEGRATION_CAPABILITIES: Capability[] = [
  {
    id: "integrations.read",
    description: "View external connections, their status, and sync health.",
    ownerModuleId: "integrations",
  },
  {
    id: "integrations.write",
    description: "Create or edit external connection records.",
    ownerModuleId: "integrations",
  },
  {
    id: "integrations.connect",
    description: "Authorize an external provider connection.",
    ownerModuleId: "integrations",
  },
  {
    id: "integrations.disconnect",
    description: "Disconnect or revoke an external provider connection.",
    ownerModuleId: "integrations",
  },
  {
    id: "integrations.sync",
    description: "Run or retry synchronization against a connected provider.",
    ownerModuleId: "integrations",
  },
];
