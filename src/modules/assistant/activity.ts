// Immutable activity event names for the Jarvis assistant module.
// Rule: names are frozen once shipped. Add new events; never rename.
// See docs/activity-events.md.
//
// Payload rule: identifiers, enums, and counts only. Never the question
// text verbatim, never customer contact details, never model credentials.

export const ASSISTANT_EVENTS = {
  queryExecuted: "assistant.query.executed",
  recommendationCreated: "assistant.recommendation.created",
  proposalCreated: "assistant.proposal.created",
  proposalApproved: "assistant.proposal.approved",
  proposalRejected: "assistant.proposal.rejected",
  attentionAcknowledged: "assistant.attention.acknowledged",
} as const;

export type AssistantEventType =
  (typeof ASSISTANT_EVENTS)[keyof typeof ASSISTANT_EVENTS];
