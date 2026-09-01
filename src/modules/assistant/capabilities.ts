// Jarvis / AI Business Assistant capabilities (Phase 12).
//
// Capability-based only — never role names (ADR-003). The four-way split
// READ / RECOMMEND / PROPOSE / EXECUTE is the durable human-control
// boundary. Phase 12 implements the first three; `jarvis.execute` is
// registered but NOTHING in this phase consumes it, so a future Phase 13
// agent can be granted observation and preparation rights while remaining
// structurally unable to act.

import type { Capability } from "@/core/roles/roles";

export const JARVIS_READ = "jarvis.read";
export const JARVIS_RECOMMEND = "jarvis.recommend";
export const JARVIS_PROPOSE = "jarvis.propose";
export const JARVIS_EXECUTE = "jarvis.execute";

export const ASSISTANT_CAPABILITIES: Capability[] = [
  {
    id: JARVIS_READ,
    description:
      "Ask Jarvis read-only business questions. Answers are further filtered by the capabilities of the underlying modules.",
    ownerModuleId: "assistant",
  },
  {
    id: JARVIS_RECOMMEND,
    description:
      "Receive Jarvis recommendations. A recommendation is never business truth and never mutates a record.",
    ownerModuleId: "assistant",
  },
  {
    id: JARVIS_PROPOSE,
    description:
      "Record an AI action proposal for human review. Recording a proposal never executes it.",
    ownerModuleId: "assistant",
  },
  {
    id: JARVIS_EXECUTE,
    description:
      "Reserved for Phase 13. No Phase 12 code path executes a proposal; holding this capability grants nothing today.",
    ownerModuleId: "assistant",
  },
];
