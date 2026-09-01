// Immutable activity event names for the Automation / Agents module.
// Rule: names are frozen once shipped. Add new events; never rename.
// See docs/activity-events.md.
//
// Payload rule: identifiers, enums, counts and short reason codes only.
// Never customer contact details, never message bodies, never credentials.

export const AUTOMATION_EVENTS = {
  agentCreated: "automation.agent.created",
  agentUpdated: "automation.agent.updated",
  agentEnabled: "automation.agent.enabled",
  agentDisabled: "automation.agent.disabled",

  ruleCreated: "automation.rule.created",
  ruleUpdated: "automation.rule.updated",
  ruleEnabled: "automation.rule.enabled",
  ruleDisabled: "automation.rule.disabled",

  runStarted: "automation.run.started",
  runSucceeded: "automation.run.succeeded",
  runFailed: "automation.run.failed",
  runBlocked: "automation.run.blocked",
  runAwaitingApproval: "automation.run.awaiting_approval",
  runCancelled: "automation.run.cancelled",

  actionRequested: "automation.action.requested",
  actionDuplicateSuppressed: "automation.action.duplicate_suppressed",
  actionBlocked: "automation.action.blocked",
  actionApprovalRequested: "automation.action.approval_requested",
  actionApproved: "automation.action.approved",
  actionRejected: "automation.action.rejected",
  actionExecuted: "automation.action.executed",
  actionFailed: "automation.action.failed",
  actionRetried: "automation.action.retried",
} as const;

export type AutomationEventType =
  (typeof AUTOMATION_EVENTS)[keyof typeof AUTOMATION_EVENTS];
