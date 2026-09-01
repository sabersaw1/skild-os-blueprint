// Controlled Automation + Agents capabilities (Phase 13).
//
// Capability-based only — never role names (ADR-003). The split is
// deliberately granular: observing automation state, editing an agent,
// letting an agent run, approving what it wants to do, and changing the
// automation rules themselves are four different powers.
//
// There is intentionally NO "agents.admin" / "agents.*" capability. An
// agent holds the SPECIFIC capabilities its actions require and nothing
// else; a broad grant would defeat the entire boundary.

import type { Capability } from "@/core/roles/roles";

export const AGENTS_READ = "agents.read";
export const AGENTS_WRITE = "agents.write";
export const AGENTS_RUN = "agents.run";
export const AGENTS_APPROVE = "agents.approve";
export const AGENTS_MANAGE = "agents.manage";

export const AUTOMATION_CAPABILITIES: Capability[] = [
  {
    id: AGENTS_READ,
    description:
      "View agents, automations, runs, actions and approvals. Read-only.",
    ownerModuleId: "automation",
  },
  {
    id: AGENTS_WRITE,
    description:
      "Create and edit agent definitions, including enabling or disabling an agent.",
    ownerModuleId: "automation",
  },
  {
    id: AGENTS_RUN,
    description:
      "Start an agent run and record its actions. Running never grants the capability an action itself requires.",
    ownerModuleId: "automation",
  },
  {
    id: AGENTS_APPROVE,
    description:
      "Approve or reject an agent action that policy says a human must decide.",
    ownerModuleId: "automation",
  },
  {
    id: AGENTS_MANAGE,
    description:
      "Create, edit, enable or disable automation rules — the business rules that decide when an agent may act.",
    ownerModuleId: "automation",
  },
];
