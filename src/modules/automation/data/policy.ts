// Centralised human-approval policy (Phase 13).
//
// WHY THIS FILE EXISTS
// --------------------
// "May an agent do this?" is a BUSINESS RULE, not a UI concern. If the rule
// lived in a route component, a non-interactive caller — an agent, an
// adapter, a future worker — would bypass it entirely. So the verdict is
// computed here, in the domain layer, and enforced by the repository.
//
// THREE VERDICTS
//   auto_execute       safe, low-risk, reversible, internal-only work
//   approval_required  a human must decide before anything happens
//   blocked            the agent is NEVER permitted to do this
//
// A rule may TIGHTEN the catalogue verdict. It can never loosen it.

import type { AgentActionType, PolicyDecision } from "./schemas";

export interface ActionDefinition {
  type: AgentActionType;
  description: string;
  /** Capabilities the ACTION requires. The agent must hold all of them. */
  capabilityIds: string[];
  /** The floor. A rule may only move it toward "blocked". */
  defaultDecision: PolicyDecision;
  reversible: boolean;
  /** Does this action touch money, a customer, or the outside world? */
  externalEffect: boolean;
}

export const ACTION_CATALOGUE: Record<AgentActionType, ActionDefinition> = {
  // --- Safe, internal, reversible: the only auto-executable work in v1 ----
  "attention.flag": {
    type: "attention.flag",
    description:
      "Record an internal attention item for a record that reached a defined stale state.",
    capabilityIds: ["jarvis.propose"],
    defaultDecision: "auto_execute",
    reversible: true,
    externalEffect: false,
  },
  "proposal.create": {
    type: "proposal.create",
    description:
      "Record an internal action proposal for a human to review. Recording is not doing.",
    capabilityIds: ["jarvis.propose"],
    defaultDecision: "auto_execute",
    reversible: true,
    externalEffect: false,
  },
  "briefing.compile": {
    type: "briefing.compile",
    description:
      "Assemble structured internal information for a future briefing. Nothing is delivered anywhere.",
    capabilityIds: ["jarvis.propose"],
    defaultDecision: "auto_execute",
    reversible: true,
    externalEffect: false,
  },

  // --- Human judgement required ------------------------------------------
  "followup.prepare": {
    type: "followup.prepare",
    description:
      "Prepare a customer follow-up for review. Preparing is not sending; nothing is queued or transmitted.",
    capabilityIds: ["jarvis.propose", "communication.read"],
    defaultDecision: "approval_required",
    reversible: true,
    externalEffect: false,
  },

  // --- Never, in this phase or by default --------------------------------
  "communication.send": {
    type: "communication.send",
    description: "Send or queue an outbound customer message.",
    capabilityIds: ["communication.send"],
    defaultDecision: "blocked",
    reversible: false,
    externalEffect: true,
  },
  "pricing.change": {
    type: "pricing.change",
    description: "Change a price or a pricing rule.",
    capabilityIds: ["quotes.write"],
    defaultDecision: "blocked",
    reversible: false,
    externalEffect: true,
  },
  "finance.invoice.issue": {
    type: "finance.invoice.issue",
    description: "Issue an invoice, freezing its immutable snapshot.",
    capabilityIds: ["finance.invoice.issue"],
    defaultDecision: "blocked",
    reversible: false,
    externalEffect: true,
  },
  "finance.payment.record": {
    type: "finance.payment.record",
    description: "Record a payment against an invoice.",
    capabilityIds: ["finance.payment.write"],
    defaultDecision: "blocked",
    reversible: false,
    externalEffect: true,
  },
  "finance.refund": {
    type: "finance.refund",
    description: "Refund money to a customer.",
    capabilityIds: ["finance.payment.write"],
    defaultDecision: "blocked",
    reversible: false,
    externalEffect: true,
  },
  "marketing.publish": {
    type: "marketing.publish",
    description: "Publish content to a public surface.",
    capabilityIds: ["marketing.publish"],
    defaultDecision: "blocked",
    reversible: false,
    externalEffect: true,
  },
  "record.delete": {
    type: "record.delete",
    description: "Delete a business record.",
    capabilityIds: ["system.admin"],
    defaultDecision: "blocked",
    reversible: false,
    externalEffect: true,
  },
};

const STRICTNESS: Record<PolicyDecision, number> = {
  auto_execute: 0,
  approval_required: 1,
  blocked: 2,
};

export interface PolicyVerdict {
  decision: PolicyDecision;
  reason: string;
  capabilityIds: string[];
}

/**
 * The authoritative verdict for one action.
 *
 * `rulePolicy` is the automation rule's own setting. It is applied only when
 * it is STRICTER than the catalogue default — a rule can never authorise an
 * action the catalogue forbids, and can never make a
 * human-approval action automatic.
 */
export function decideActionPolicy(
  actionType: AgentActionType,
  rulePolicy?: PolicyDecision,
): PolicyVerdict {
  const def = ACTION_CATALOGUE[actionType];
  if (!def) {
    return {
      decision: "blocked",
      reason: `Unknown action type "${actionType}". Unknown is always blocked.`,
      capabilityIds: [],
    };
  }

  let decision = def.defaultDecision;
  let reason =
    def.defaultDecision === "blocked"
      ? `"${actionType}" is never performed autonomously: ${def.description}`
      : def.defaultDecision === "approval_required"
        ? `"${actionType}" needs a human decision: ${def.description}`
        : `"${actionType}" is internal and reversible: ${def.description}`;

  if (rulePolicy && STRICTNESS[rulePolicy] > STRICTNESS[decision]) {
    decision = rulePolicy;
    reason = `The automation rule tightened this action to "${rulePolicy}".`;
  }

  return { decision, reason, capabilityIds: [...def.capabilityIds] };
}

/** Actions an agent may ever run automatically, for UI hints and docs. */
export function autoExecutableActionTypes(): AgentActionType[] {
  return (Object.keys(ACTION_CATALOGUE) as AgentActionType[]).filter(
    (t) => ACTION_CATALOGUE[t].defaultDecision === "auto_execute",
  );
}
