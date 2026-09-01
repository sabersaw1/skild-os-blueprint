// Automation repository — public interface only.
//
// This interface IS the controlled execution boundary's persistence side.
// Agents, adapters, workers and the UI all reach automation state through
// it; nobody imports the local implementation.
//
// Every consequential method is capability-guarded inside the factory (see
// ./local-repository.ts), so authorization happens before validation,
// mutation, persistence and emission — however the caller obtained the
// repository.

import type {
  ActionListQuery,
  ActionRequestInput,
  Agent,
  AgentAction,
  AgentCreateInput,
  AgentRun,
  AgentUpdateInput,
  Approval,
  AutomationOverview,
  AutomationRule,
  AutomationRuleCreateInput,
  AutomationRuleUpdateInput,
  RunListQuery,
  RunStatus,
  RunTriggerInfo,
} from "./schemas";

export const AUTOMATION_REPOSITORY = "automation.repository";

export interface AutomationRepository {
  // ---- Agents -----------------------------------------------------------
  listAgents(): Promise<Agent[]>;
  getAgent(id: string): Promise<Agent | undefined>;
  createAgent(input: AgentCreateInput): Promise<Agent>;
  updateAgent(id: string, input: AgentUpdateInput): Promise<Agent>;
  setAgentEnabled(id: string, enabled: boolean): Promise<Agent>;

  // ---- Automation rules --------------------------------------------------
  listRules(agentId?: string): Promise<AutomationRule[]>;
  getRule(id: string): Promise<AutomationRule | undefined>;
  createRule(input: AutomationRuleCreateInput): Promise<AutomationRule>;
  updateRule(
    id: string,
    input: AutomationRuleUpdateInput,
  ): Promise<AutomationRule>;
  setRuleEnabled(id: string, enabled: boolean): Promise<AutomationRule>;

  // ---- Runs ---------------------------------------------------------------
  listRuns(query?: RunListQuery): Promise<AgentRun[]>;
  getRun(id: string): Promise<AgentRun | undefined>;
  /**
   * Open a run. Refuses a disabled agent or a disabled rule — an agent that
   * is switched off cannot act, whoever asked.
   */
  startRun(input: {
    agentId: string;
    automationRuleId?: string;
    trigger: RunTriggerInfo;
  }): Promise<AgentRun>;
  /** Close a run with a terminal status. A run cannot be closed twice. */
  completeRun(
    id: string,
    status: Extract<
      RunStatus,
      "succeeded" | "failed" | "blocked" | "awaiting_approval" | "cancelled"
    >,
    detail?: { outcome?: string; errorCode?: string; errorMessage?: string },
  ): Promise<AgentRun>;

  // ---- Actions -------------------------------------------------------------
  listActions(query?: ActionListQuery): Promise<AgentAction[]>;
  getAction(id: string): Promise<AgentAction | undefined>;
  findActionByIdempotencyKey(key: string): Promise<AgentAction | undefined>;
  /**
   * Request an action inside a run. This applies the centralised policy:
   * the action is created already blocked, already awaiting approval, or
   * cleared for execution. Requesting NEVER executes.
   *
   * Idempotent: a second request with the same key returns the existing
   * action instead of creating a duplicate, unless the previous attempt
   * failed and retries remain.
   */
  requestAction(input: ActionRequestInput): Promise<AgentAction>;

  // ---- Approvals -----------------------------------------------------------
  listApprovals(state?: "pending" | "decided"): Promise<Approval[]>;
  getApproval(id: string): Promise<Approval | undefined>;
  approveAction(actionId: string, reason?: string): Promise<AgentAction>;
  rejectAction(actionId: string, reason?: string): Promise<AgentAction>;

  // ---- Execution results ----------------------------------------------------
  /**
   * Record that the underlying operation ACTUALLY succeeded. The executor
   * calls this only after the real repository call returned.
   */
  markActionExecuted(
    actionId: string,
    resultSummary: string,
  ): Promise<AgentAction>;
  markActionFailed(
    actionId: string,
    error: { code: string; message: string },
  ): Promise<AgentAction>;

  // ---- Read models ------------------------------------------------------------
  getOverview(now?: number): Promise<AutomationOverview>;

  subscribe(listener: () => void): () => void;
}
