// Default agents and rules (Phase 13).
//
// Seeded ONCE, only when the store is empty, and only with agents whose
// entire action surface is internal: flag attention, prepare a follow-up for
// review. Nothing seeded here can send, publish, price, charge or delete —
// those action types are blocked by policy, so no rule may propose them and
// no seed could grant them.
//
// Every seeded agent starts DISABLED. Automation begins switched off; a
// human turns it on.

import type { AutomationRepository } from "./repository";

export interface SeedSpec {
  name: string;
  purpose: string;
  description: string;
  rules: Array<{
    name: string;
    description: string;
    observerId: string;
    proposedActionType: "attention.flag" | "followup.prepare";
    staleDays: number;
  }>;
}

export const DEFAULT_AGENTS: SeedSpec[] = [
  {
    name: "Follow-up Watcher",
    purpose:
      "Notice leads and quotes that have gone quiet, and put them in front of a human.",
    description:
      "Reads leads, quotes and conversations. Records internal attention items and draft follow-ups for review. Sends nothing.",
    rules: [
      {
        name: "Stale leads need a look",
        description:
          "A lead with no recorded touch for 7 days is flagged internally.",
        observerId: "lead.stale",
        proposedActionType: "attention.flag",
        staleDays: 7,
      },
      {
        name: "Sent quotes with no response",
        description:
          "A quote sitting in 'sent' for 7 days gets a follow-up prepared for human review.",
        observerId: "quote.stale",
        proposedActionType: "followup.prepare",
        staleDays: 7,
      },
      {
        name: "Conversations awaiting us",
        description:
          "A thread awaiting a Skild reply for 2 days is flagged internally.",
        observerId: "conversation.awaiting_skild",
        proposedActionType: "attention.flag",
        staleDays: 2,
      },
    ],
  },
];

export async function seedDefaultAutomation(
  repo: AutomationRepository,
): Promise<void> {
  const existing = await repo.listAgents();
  if (existing.length > 0) return;

  for (const spec of DEFAULT_AGENTS) {
    const agent = await repo.createAgent({
      name: spec.name,
      purpose: spec.purpose,
      description: spec.description,
      status: "disabled",
      allowedCapabilityIds: ["agents.run", "jarvis.propose"],
    });
    for (const rule of spec.rules) {
      await repo.createRule({
        agentId: agent.id,
        name: rule.name,
        description: rule.description,
        trigger: {
          kind: "record_state",
          observerId: rule.observerId,
          description: `Evaluated when a run is started; no scheduler runs it.`,
        },
        conditions: [
          {
            field: rule.observerId.startsWith("lead")
              ? "lastTouchedAt"
              : "updatedAt",
            operator: "older_than_days",
            value: rule.staleDays,
          },
        ],
        proposedActionType: rule.proposedActionType,
        enabled: true,
      });
    }
  }
}
