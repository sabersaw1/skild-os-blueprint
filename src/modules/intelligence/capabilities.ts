// Business Intelligence capabilities (Phase 14).
//
// Capability-based only — never role names (ADR-003). The split is the
// durable human-control boundary:
//   read        — see metrics, reports and findings
//   calculate   — persist a measurement snapshot
//   recommend   — record an observation / opportunity / PROPOSAL
//   acknowledge — a human states they have seen or accepted a finding
//   dismiss     — a human rejects a finding
//
// There is deliberately NO "intelligence.execute". Acting on a
// recommendation goes through the Phase 13 automation boundary and the
// owning module's own capabilities (pricing, communication, finance…).
// Business Intelligence proposes; it never acts.

import type { Capability } from "@/core/roles/roles";

export const INTELLIGENCE_READ = "intelligence.read";
export const INTELLIGENCE_CALCULATE = "intelligence.calculate";
export const INTELLIGENCE_RECOMMEND = "intelligence.recommend";
export const INTELLIGENCE_ACKNOWLEDGE = "intelligence.acknowledge";
export const INTELLIGENCE_DISMISS = "intelligence.dismiss";

export const INTELLIGENCE_CAPABILITIES: Capability[] = [
  {
    id: INTELLIGENCE_READ,
    description:
      "View business metrics, funnel, profitability, performance reports and recorded findings.",
    ownerModuleId: "intelligence",
  },
  {
    id: INTELLIGENCE_CALCULATE,
    description:
      "Calculate and durably record metric snapshots for a period. Reads source records only.",
    ownerModuleId: "intelligence",
  },
  {
    id: INTELLIGENCE_RECOMMEND,
    description:
      "Record evidence-backed observations, opportunities and recommendations. Proposals only — executes nothing.",
    ownerModuleId: "intelligence",
  },
  {
    id: INTELLIGENCE_ACKNOWLEDGE,
    description:
      "Record that a human has seen, accepted, resolved or completed a finding. Human review boundary.",
    ownerModuleId: "intelligence",
  },
  {
    id: INTELLIGENCE_DISMISS,
    description: "Reject a finding or recommendation with a reason.",
    ownerModuleId: "intelligence",
  },
];
