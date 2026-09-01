// Automation / Agents domain model (Phase 13).
//
// SOURCE-OF-TRUTH RULE
// --------------------
// Nothing here copies a Customer, Vehicle, Lead, Quote, Job, Part, Invoice,
// Payment, Conversation or Knowledge record. An agent record references a
// domain entity by a stable id through `EntityRef`, and the owning module
// stays the only source of truth.
//
// KNOWLEDGE SAFETY
// ----------------
// An agent observation is SYSTEM-DERIVED and an agent action's rationale is
// an AI/heuristic SUGGESTION. Neither is ever business truth, and neither is
// promoted to verified knowledge by any code path in this module.

/** Stable, opaque reference to a record owned by another module. */
export interface EntityRef {
  module: string;
  entity: string;
  id: string;
}

// ---- Agent ---------------------------------------------------------------

export type AgentStatus = "disabled" | "active";

export interface Agent {
  id: string;
  name: string;
  description: string;
  /** What the agent is for, in business language. */
  purpose: string;
  status: AgentStatus;
  /**
   * The exact capability ids this agent is allowed to exercise. An action
   * whose required capabilities are not ALL present here is refused at the
   * execution boundary, even if the human running it holds them.
   */
  allowedCapabilityIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface AgentCreateInput {
  name: string;
  description?: string;
  purpose: string;
  allowedCapabilityIds?: string[];
  status?: AgentStatus;
}

export interface AgentUpdateInput {
  name?: string;
  description?: string;
  purpose?: string;
  allowedCapabilityIds?: string[];
}

// ---- Trigger abstraction --------------------------------------------------

export type TriggerKind =
  | "activity_event"
  | "schedule"
  | "record_state"
  | "manual";

export const TRIGGER_KINDS: TriggerKind[] = [
  "activity_event",
  "schedule",
  "record_state",
  "manual",
];

/**
 * A trigger DESCRIBES when a rule is eligible. Phase 13 ships no scheduler
 * and no event bus subscription: `manual` and `record_state` are evaluated
 * when a run is started. `activity_event` and `schedule` are representable
 * so a later phase can drive them without a model change.
 */
export interface TriggerDefinition {
  kind: TriggerKind;
  /** For `activity_event`: the immutable event name, e.g. "marketing.lead.created". */
  eventType?: string;
  /** For `record_state`: an opaque observer id, e.g. "lead.stale". */
  observerId?: string;
  /** For `schedule`: milliseconds between eligible runs. No scheduler runs it. */
  intervalMs?: number;
  description?: string;
}

export type ConditionOperator =
  | "eq"
  | "gte"
  | "lte"
  | "exists"
  | "older_than_days";

export interface RuleCondition {
  field: string;
  operator: ConditionOperator;
  value?: string | number | boolean;
}

// ---- Action catalogue -----------------------------------------------------

export const AGENT_ACTION_TYPES = [
  "attention.flag",
  "proposal.create",
  "briefing.compile",
  "followup.prepare",
  "communication.send",
  "pricing.change",
  "finance.invoice.issue",
  "finance.payment.record",
  "finance.refund",
  "marketing.publish",
  "record.delete",
] as const;

export type AgentActionType = (typeof AGENT_ACTION_TYPES)[number];

/** The centralised policy verdict for an action. */
export type PolicyDecision = "auto_execute" | "approval_required" | "blocked";

// ---- Automation rule ------------------------------------------------------

export interface ExecutionPolicy {
  /** Bounded retry. A blocked or approval-required action is never retried. */
  maxAttempts: number;
  /**
   * Idempotency window. The same agent + rule + action type + targets inside
   * one window is ONE action, however many times the trigger fires.
   */
  idempotencyWindowMs: number;
}

export const DEFAULT_EXECUTION_POLICY: ExecutionPolicy = {
  maxAttempts: 2,
  idempotencyWindowMs: 24 * 60 * 60 * 1000,
};

export interface AutomationRule {
  id: string;
  agentId: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: TriggerDefinition;
  conditions: RuleCondition[];
  /** The single action type this rule may produce. */
  proposedActionType: AgentActionType;
  /** Capabilities the produced action will require. Derived from the catalogue. */
  requiredCapabilityIds: string[];
  /**
   * A rule may only TIGHTEN the catalogue policy (auto → approval → blocked).
   * It can never loosen it.
   */
  approvalPolicy: PolicyDecision;
  executionPolicy: ExecutionPolicy;
  createdAt: number;
  updatedAt: number;
}

export interface AutomationRuleCreateInput {
  agentId: string;
  name: string;
  description?: string;
  trigger: TriggerDefinition;
  conditions?: RuleCondition[];
  proposedActionType: AgentActionType;
  approvalPolicy?: PolicyDecision;
  executionPolicy?: Partial<ExecutionPolicy>;
  enabled?: boolean;
}

export interface AutomationRuleUpdateInput {
  name?: string;
  description?: string;
  trigger?: TriggerDefinition;
  conditions?: RuleCondition[];
  approvalPolicy?: PolicyDecision;
  executionPolicy?: Partial<ExecutionPolicy>;
}

// ---- Run ------------------------------------------------------------------

export type RunStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "blocked"
  | "awaiting_approval"
  | "cancelled";

export interface RunTriggerInfo {
  kind: TriggerKind;
  /** Free-form short source label, e.g. "manual:ui", "observer:lead.stale". */
  source: string;
  eventType?: string;
}

export interface AgentRun {
  id: string;
  agentId: string;
  automationRuleId?: string;
  trigger: RunTriggerInfo;
  /** Stable correlation id shared by every action and event of this run. */
  correlationId: string;
  status: RunStatus;
  startedAt: number;
  completedAt?: number;
  /** Short, non-sensitive outcome summary. */
  outcome?: string;
  errorCode?: string;
  errorMessage?: string;
  /** Identity that executed the run (human operator or future agent identity). */
  executedBy: string;
  actionCount: number;
}

// ---- Action ---------------------------------------------------------------

export type ApprovalState =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected";

export type ActionExecutionState =
  | "not_executed"
  | "executed"
  | "failed"
  | "blocked"
  | "cancelled";

export interface AgentAction {
  id: string;
  runId: string;
  agentId: string;
  automationRuleId?: string;
  correlationId: string;
  actionType: AgentActionType;
  policyDecision: PolicyDecision;
  /** Why the policy decided what it decided. Human-readable, no PII. */
  policyReason: string;
  targets: EntityRef[];
  requestedCapabilityIds: string[];
  approvalState: ApprovalState;
  approvalId?: string;
  executionState: ActionExecutionState;
  /** Concise result. Identifiers and counts only. */
  resultSummary?: string;
  errorCode?: string;
  errorMessage?: string;
  /** Stable duplicate-suppression key. Unique per action record. */
  idempotencyKey: string;
  attempt: number;
  maxAttempts: number;
  createdAt: number;
  updatedAt: number;
  executedAt?: number;
}

export interface ActionRequestInput {
  runId: string;
  actionType: AgentActionType;
  targets: EntityRef[];
  /** Why the agent wants this. A SUGGESTION, never a verified fact. */
  rationale: string;
  idempotencyKey: string;
}

// ---- Approval -------------------------------------------------------------

export interface Approval {
  id: string;
  actionId: string;
  runId: string;
  requestedAt: number;
  requestedBy: string;
  approvedAt?: number;
  approvedBy?: string;
  rejectedAt?: number;
  rejectedBy?: string;
  reason?: string;
}

// ---- Queries & read models -------------------------------------------------

export interface RunListQuery {
  agentId?: string;
  automationRuleId?: string;
  status?: RunStatus;
  limit?: number;
}

export interface ActionListQuery {
  runId?: string;
  agentId?: string;
  actionType?: AgentActionType;
  approvalState?: ApprovalState;
  executionState?: ActionExecutionState;
  limit?: number;
}

/** Operational read model for the Command Center widget and for Jarvis. */
export interface AutomationOverview {
  activeAgents: number;
  activeAutomations: number;
  pendingApprovals: number;
  failedRuns: number;
  completedRunsToday: number;
  blockedActions: number;
  runningRuns: number;
}
