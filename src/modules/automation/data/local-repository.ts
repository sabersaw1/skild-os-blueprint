// Local implementation of AutomationRepository (Phase 13).
// Repository implementations are the ONLY place allowed to touch storage.
//
// Storage keys (versioned envelopes — see ./storage.ts):
//   skildos.automation.agents.v1
//   skildos.automation.rules.v1
//   skildos.automation.runs.v1
//   skildos.automation.actions.v1
//   skildos.automation.approvals.v1
//
// MUTATION ORDER (Phase 12.2 contract, unchanged here):
//   authorize → validate → persist → CONFIRM persistence → emit → return
// A failed write throws PersistenceError before emit(), so no successful
// business event can describe a change that was not stored.
//
// PHASE 13 BOUNDARY
//   • Nothing in this file sends, publishes, spends, schedules or contacts.
//   • `markActionExecuted` records that an operation ALREADY succeeded; it
//     performs no operation itself. The executor calls it after the real
//     repository call returned.
//   • Approval state is durable and cannot be bypassed by setting a flag:
//     the required verdict is re-derived from the policy, never trusted
//     from the stored record.

import { newId } from "@/core/ids";
import { getIdentity } from "@/core/auth/identity";
import { emit } from "@/core/activity/emitter";
import { commitRecords } from "@/core/storage/persistence";
import { withCapabilityEnforcement } from "@/core/auth/authorize";
import { AUTOMATION_EVENTS } from "../activity";
import {
  AGENTS_APPROVE,
  AGENTS_MANAGE,
  AGENTS_RUN,
  AGENTS_WRITE,
} from "../capabilities";
import { ACTION_CATALOGUE, decideActionPolicy } from "./policy";
import type { AutomationRepository } from "./repository";
import { readEnvelope, registerVersionedKey } from "./storage";
import {
  AGENT_ACTION_TYPES,
  DEFAULT_EXECUTION_POLICY,
  TRIGGER_KINDS,
  type ActionListQuery,
  type ActionRequestInput,
  type Agent,
  type AgentAction,
  type AgentCreateInput,
  type AgentRun,
  type AgentUpdateInput,
  type Approval,
  type AutomationOverview,
  type AutomationRule,
  type AutomationRuleCreateInput,
  type AutomationRuleUpdateInput,
  type RunListQuery,
  type RunStatus,
  type RunTriggerInfo,
} from "./schemas";

const K_AGENTS = "skildos.automation.agents.v1";
const K_RULES = "skildos.automation.rules.v1";
const K_RUNS = "skildos.automation.runs.v1";
const K_ACTIONS = "skildos.automation.actions.v1";
const K_APPROVALS = "skildos.automation.approvals.v1";

registerVersionedKey<Agent>({
  key: K_AGENTS,
  currentVersion: 1,
  migrations: {
    0: (records) =>
      (records as Agent[]).map((a) => ({
        ...a,
        allowedCapabilityIds: a.allowedCapabilityIds ?? [],
        status: a.status ?? "disabled",
      })),
  },
});
registerVersionedKey<AutomationRule>({
  key: K_RULES,
  currentVersion: 1,
  migrations: { 0: (records) => records as AutomationRule[] },
});
registerVersionedKey<AgentRun>({
  key: K_RUNS,
  currentVersion: 1,
  migrations: { 0: (records) => records as AgentRun[] },
});
registerVersionedKey<AgentAction>({
  key: K_ACTIONS,
  currentVersion: 1,
  migrations: { 0: (records) => records as AgentAction[] },
});
registerVersionedKey<Approval>({
  key: K_APPROVALS,
  currentVersion: 1,
  migrations: { 0: (records) => records as Approval[] },
});

const TERMINAL_RUN_STATUSES: RunStatus[] = [
  "succeeded",
  "failed",
  "blocked",
  "awaiting_approval",
  "cancelled",
];

function startOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function text(value: string | undefined, field: string): string {
  const v = value?.trim();
  if (!v) throw new Error(`Automation: ${field} is required.`);
  return v;
}

class LocalAutomationRepository implements AutomationRepository {
  private listeners = new Set<() => void>();

  private notify(): void {
    this.listeners.forEach((l) => l());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ---- storage ------------------------------------------------------------
  private agents(): Agent[] {
    return readEnvelope<Agent>(K_AGENTS);
  }
  private rules(): AutomationRule[] {
    return readEnvelope<AutomationRule>(K_RULES);
  }
  private runs(): AgentRun[] {
    return readEnvelope<AgentRun>(K_RUNS);
  }
  private actions(): AgentAction[] {
    return readEnvelope<AgentAction>(K_ACTIONS);
  }
  private approvals(): Approval[] {
    return readEnvelope<Approval>(K_APPROVALS);
  }

  /** Durable write or throw. Returns the committed collection. */
  private commit<T>(key: string, rows: T[]): T[] {
    const next = commitRecords(key, rows);
    this.notify();
    return next;
  }

  // ---- Agents --------------------------------------------------------------
  async listAgents(): Promise<Agent[]> {
    return this.agents().sort((a, b) => a.name.localeCompare(b.name));
  }

  async getAgent(id: string): Promise<Agent | undefined> {
    return this.agents().find((a) => a.id === id);
  }

  async createAgent(input: AgentCreateInput): Promise<Agent> {
    const name = text(input.name, "an agent name");
    const purpose = text(input.purpose, "an agent purpose");
    const allowed = [...new Set(input.allowedCapabilityIds ?? [])];
    const now = Date.now();
    const agent: Agent = {
      id: newId(),
      name,
      description: input.description?.trim() ?? "",
      purpose,
      // An agent is born switched OFF unless explicitly created active.
      status: input.status === "active" ? "active" : "disabled",
      allowedCapabilityIds: allowed,
      createdAt: now,
      updatedAt: now,
    };
    this.commit(K_AGENTS, [...this.agents(), agent]);
    emit({
      type: AUTOMATION_EVENTS.agentCreated,
      moduleId: "automation",
      summary: `Agent created: ${agent.name}`,
      payload: {
        agentId: agent.id,
        status: agent.status,
        capabilityCount: agent.allowedCapabilityIds.length,
      },
    });
    return agent;
  }

  async updateAgent(id: string, input: AgentUpdateInput): Promise<Agent> {
    const rows = this.agents();
    const idx = rows.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error(`Automation: no agent with id "${id}".`);
    const current = rows[idx]!;
    const next: Agent = {
      ...current,
      name: input.name !== undefined ? text(input.name, "an agent name") : current.name,
      description:
        input.description !== undefined
          ? input.description.trim()
          : current.description,
      purpose:
        input.purpose !== undefined
          ? text(input.purpose, "an agent purpose")
          : current.purpose,
      allowedCapabilityIds:
        input.allowedCapabilityIds !== undefined
          ? [...new Set(input.allowedCapabilityIds)]
          : current.allowedCapabilityIds,
      updatedAt: Date.now(),
    };
    const copy = [...rows];
    copy[idx] = next;
    this.commit(K_AGENTS, copy);
    emit({
      type: AUTOMATION_EVENTS.agentUpdated,
      moduleId: "automation",
      summary: `Agent updated: ${next.name}`,
      payload: { agentId: next.id },
    });
    return next;
  }

  async setAgentEnabled(id: string, enabled: boolean): Promise<Agent> {
    const rows = this.agents();
    const idx = rows.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error(`Automation: no agent with id "${id}".`);
    const next: Agent = {
      ...rows[idx]!,
      status: enabled ? "active" : "disabled",
      updatedAt: Date.now(),
    };
    const copy = [...rows];
    copy[idx] = next;
    this.commit(K_AGENTS, copy);
    emit({
      type: enabled
        ? AUTOMATION_EVENTS.agentEnabled
        : AUTOMATION_EVENTS.agentDisabled,
      moduleId: "automation",
      summary: `Agent ${enabled ? "enabled" : "disabled"}: ${next.name}`,
      payload: { agentId: next.id },
    });
    return next;
  }

  // ---- Rules ---------------------------------------------------------------
  async listRules(agentId?: string): Promise<AutomationRule[]> {
    const rows = this.rules();
    return (agentId ? rows.filter((r) => r.agentId === agentId) : rows).sort(
      (a, b) => a.name.localeCompare(b.name),
    );
  }

  async getRule(id: string): Promise<AutomationRule | undefined> {
    return this.rules().find((r) => r.id === id);
  }

  async createRule(input: AutomationRuleCreateInput): Promise<AutomationRule> {
    const name = text(input.name, "a rule name");
    if (!this.agents().some((a) => a.id === input.agentId)) {
      throw new Error(
        `Automation: rule references unknown agent "${input.agentId}".`,
      );
    }
    if (!AGENT_ACTION_TYPES.includes(input.proposedActionType)) {
      throw new Error(
        `Automation: unknown action type "${input.proposedActionType}".`,
      );
    }
    if (!input.trigger || !TRIGGER_KINDS.includes(input.trigger.kind)) {
      throw new Error("Automation: a rule requires a valid trigger kind.");
    }
    // The rule can only tighten. Re-derive rather than trust the input.
    const verdict = decideActionPolicy(
      input.proposedActionType,
      input.approvalPolicy,
    );
    const now = Date.now();
    const rule: AutomationRule = {
      id: newId(),
      agentId: input.agentId,
      name,
      description: input.description?.trim() ?? "",
      // A rule proposing an action the catalogue forbids can be described,
      // but never armed — otherwise it would sit enabled, look live, and
      // fail only at execution time.
      enabled: input.enabled === true && verdict.decision !== "blocked",
      trigger: { ...input.trigger },
      conditions: input.conditions ? [...input.conditions] : [],
      proposedActionType: input.proposedActionType,
      requiredCapabilityIds: verdict.capabilityIds,
      approvalPolicy: verdict.decision,
      executionPolicy: {
        ...DEFAULT_EXECUTION_POLICY,
        ...(input.executionPolicy ?? {}),
      },
      createdAt: now,
      updatedAt: now,
    };
    if (rule.executionPolicy.maxAttempts < 1) {
      throw new Error("Automation: maxAttempts must be at least 1.");
    }
    this.commit(K_RULES, [...this.rules(), rule]);
    emit({
      type: AUTOMATION_EVENTS.ruleCreated,
      moduleId: "automation",
      summary: `Automation rule created: ${rule.name}`,
      payload: {
        ruleId: rule.id,
        agentId: rule.agentId,
        actionType: rule.proposedActionType,
        approvalPolicy: rule.approvalPolicy,
        triggerKind: rule.trigger.kind,
      },
    });
    return rule;
  }

  async updateRule(
    id: string,
    input: AutomationRuleUpdateInput,
  ): Promise<AutomationRule> {
    const rows = this.rules();
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`Automation: no rule with id "${id}".`);
    const current = rows[idx]!;
    if (input.trigger && !TRIGGER_KINDS.includes(input.trigger.kind)) {
      throw new Error("Automation: a rule requires a valid trigger kind.");
    }
    const verdict = decideActionPolicy(
      current.proposedActionType,
      input.approvalPolicy ?? current.approvalPolicy,
    );
    const next: AutomationRule = {
      ...current,
      name: input.name !== undefined ? text(input.name, "a rule name") : current.name,
      description:
        input.description !== undefined
          ? input.description.trim()
          : current.description,
      trigger: input.trigger ? { ...input.trigger } : current.trigger,
      conditions: input.conditions ? [...input.conditions] : current.conditions,
      approvalPolicy: verdict.decision,
      requiredCapabilityIds: verdict.capabilityIds,
      executionPolicy: {
        ...current.executionPolicy,
        ...(input.executionPolicy ?? {}),
      },
      updatedAt: Date.now(),
    };
    const copy = [...rows];
    copy[idx] = next;
    this.commit(K_RULES, copy);
    emit({
      type: AUTOMATION_EVENTS.ruleUpdated,
      moduleId: "automation",
      summary: `Automation rule updated: ${next.name}`,
      payload: { ruleId: next.id, approvalPolicy: next.approvalPolicy },
    });
    return next;
  }

  async setRuleEnabled(id: string, enabled: boolean): Promise<AutomationRule> {
    const rows = this.rules();
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`Automation: no rule with id "${id}".`);
    if (enabled && rows[idx]!.approvalPolicy === "blocked") {
      throw new Error(
        `Automation: rule "${rows[idx]!.name}" proposes a blocked action and cannot be enabled.`,
      );
    }
    const next: AutomationRule = {
      ...rows[idx]!,
      enabled,
      updatedAt: Date.now(),
    };
    const copy = [...rows];
    copy[idx] = next;
    this.commit(K_RULES, copy);
    emit({
      type: enabled
        ? AUTOMATION_EVENTS.ruleEnabled
        : AUTOMATION_EVENTS.ruleDisabled,
      moduleId: "automation",
      summary: `Automation rule ${enabled ? "enabled" : "disabled"}: ${next.name}`,
      payload: { ruleId: next.id },
    });
    return next;
  }

  // ---- Runs ------------------------------------------------------------------
  async listRuns(query: RunListQuery = {}): Promise<AgentRun[]> {
    let rows = this.runs();
    if (query.agentId) rows = rows.filter((r) => r.agentId === query.agentId);
    if (query.automationRuleId) {
      rows = rows.filter((r) => r.automationRuleId === query.automationRuleId);
    }
    if (query.status) rows = rows.filter((r) => r.status === query.status);
    rows = rows.sort((a, b) => b.startedAt - a.startedAt);
    return query.limit ? rows.slice(0, query.limit) : rows;
  }

  async getRun(id: string): Promise<AgentRun | undefined> {
    return this.runs().find((r) => r.id === id);
  }

  async startRun(input: {
    agentId: string;
    automationRuleId?: string;
    trigger: RunTriggerInfo;
  }): Promise<AgentRun> {
    const agent = this.agents().find((a) => a.id === input.agentId);
    if (!agent) {
      throw new Error(`Automation: no agent with id "${input.agentId}".`);
    }
    if (agent.status !== "active") {
      throw new Error(
        `Automation: agent "${agent.name}" is disabled and cannot run.`,
      );
    }
    if (input.automationRuleId) {
      const rule = this.rules().find((r) => r.id === input.automationRuleId);
      if (!rule) {
        throw new Error(
          `Automation: no rule with id "${input.automationRuleId}".`,
        );
      }
      if (rule.agentId !== agent.id) {
        throw new Error(
          "Automation: the rule belongs to a different agent.",
        );
      }
      if (!rule.enabled) {
        throw new Error(
          `Automation: rule "${rule.name}" is disabled and cannot run.`,
        );
      }
    }
    if (!input.trigger || !TRIGGER_KINDS.includes(input.trigger.kind)) {
      throw new Error("Automation: a run requires a valid trigger.");
    }

    const now = Date.now();
    const run: AgentRun = {
      id: newId(),
      agentId: agent.id,
      automationRuleId: input.automationRuleId,
      trigger: { ...input.trigger },
      correlationId: newId(),
      status: "running",
      startedAt: now,
      executedBy: getIdentity().id,
      actionCount: 0,
    };
    this.commit(K_RUNS, [...this.runs(), run]);
    emit({
      type: AUTOMATION_EVENTS.runStarted,
      moduleId: "automation",
      summary: `Agent run started: ${agent.name}`,
      payload: {
        runId: run.id,
        agentId: agent.id,
        ruleId: run.automationRuleId,
        correlationId: run.correlationId,
        triggerKind: run.trigger.kind,
        triggerSource: run.trigger.source,
      },
    });
    return run;
  }

  private putRun(next: AgentRun): AgentRun {
    const rows = this.runs();
    const idx = rows.findIndex((r) => r.id === next.id);
    if (idx === -1) throw new Error(`Automation: no run with id "${next.id}".`);
    const copy = [...rows];
    copy[idx] = next;
    this.commit(K_RUNS, copy);
    return next;
  }

  async completeRun(
    id: string,
    status: Extract<
      RunStatus,
      "succeeded" | "failed" | "blocked" | "awaiting_approval" | "cancelled"
    >,
    detail: { outcome?: string; errorCode?: string; errorMessage?: string } = {},
  ): Promise<AgentRun> {
    const current = this.runs().find((r) => r.id === id);
    if (!current) throw new Error(`Automation: no run with id "${id}".`);
    if (TERMINAL_RUN_STATUSES.includes(current.status)) {
      throw new Error(
        `Automation: run is already "${current.status}" and cannot be completed again.`,
      );
    }
    if (!TERMINAL_RUN_STATUSES.includes(status)) {
      throw new Error(`Automation: "${status}" is not a terminal run status.`);
    }
    const now = Date.now();
    const next = this.putRun({
      ...current,
      status,
      completedAt: now,
      outcome: detail.outcome?.trim() || current.outcome,
      errorCode: detail.errorCode,
      errorMessage: detail.errorMessage,
      actionCount: this.actions().filter((a) => a.runId === id).length,
    });
    const type =
      status === "succeeded"
        ? AUTOMATION_EVENTS.runSucceeded
        : status === "failed"
          ? AUTOMATION_EVENTS.runFailed
          : status === "blocked"
            ? AUTOMATION_EVENTS.runBlocked
            : status === "cancelled"
              ? AUTOMATION_EVENTS.runCancelled
              : AUTOMATION_EVENTS.runAwaitingApproval;
    emit({
      type,
      moduleId: "automation",
      summary: `Agent run ${status.replace("_", " ")}`,
      payload: {
        runId: next.id,
        agentId: next.agentId,
        ruleId: next.automationRuleId,
        correlationId: next.correlationId,
        status,
        actionCount: next.actionCount,
        errorCode: next.errorCode,
      },
    });
    return next;
  }

  // ---- Actions ----------------------------------------------------------------
  async listActions(query: ActionListQuery = {}): Promise<AgentAction[]> {
    let rows = this.actions();
    if (query.runId) rows = rows.filter((a) => a.runId === query.runId);
    if (query.agentId) rows = rows.filter((a) => a.agentId === query.agentId);
    if (query.actionType) {
      rows = rows.filter((a) => a.actionType === query.actionType);
    }
    if (query.approvalState) {
      rows = rows.filter((a) => a.approvalState === query.approvalState);
    }
    if (query.executionState) {
      rows = rows.filter((a) => a.executionState === query.executionState);
    }
    rows = rows.sort((a, b) => b.createdAt - a.createdAt);
    return query.limit ? rows.slice(0, query.limit) : rows;
  }

  async getAction(id: string): Promise<AgentAction | undefined> {
    return this.actions().find((a) => a.id === id);
  }

  async findActionByIdempotencyKey(
    key: string,
  ): Promise<AgentAction | undefined> {
    return this.actions().find((a) => a.idempotencyKey === key);
  }

  private putAction(next: AgentAction): AgentAction {
    const rows = this.actions();
    const idx = rows.findIndex((a) => a.id === next.id);
    if (idx === -1) {
      throw new Error(`Automation: no action with id "${next.id}".`);
    }
    const copy = [...rows];
    copy[idx] = next;
    this.commit(K_ACTIONS, copy);
    return next;
  }

  async requestAction(input: ActionRequestInput): Promise<AgentAction> {
    // ---- validate --------------------------------------------------------
    const run = this.runs().find((r) => r.id === input.runId);
    if (!run) throw new Error(`Automation: no run with id "${input.runId}".`);
    if (run.status !== "running") {
      throw new Error(
        `Automation: run is "${run.status}"; actions can only be requested while it is running.`,
      );
    }
    if (!AGENT_ACTION_TYPES.includes(input.actionType)) {
      throw new Error(`Automation: unknown action type "${input.actionType}".`);
    }
    if (!input.targets?.length) {
      throw new Error(
        "Automation: an action requires at least one target record reference.",
      );
    }
    for (const t of input.targets) {
      if (!t.module || !t.entity || !t.id) {
        throw new Error(
          "Automation: every action target needs module, entity and id.",
        );
      }
    }
    const rationale = text(input.rationale, "an action rationale");
    const idempotencyKey = text(input.idempotencyKey, "an idempotency key");

    const agent = this.agents().find((a) => a.id === run.agentId);
    if (!agent) throw new Error("Automation: the run's agent no longer exists.");
    const rule = run.automationRuleId
      ? this.rules().find((r) => r.id === run.automationRuleId)
      : undefined;

    // ---- idempotency -----------------------------------------------------
    const existing = this.actions().find(
      (a) => a.idempotencyKey === idempotencyKey,
    );
    if (existing) {
      const retryable =
        existing.executionState === "failed" &&
        existing.attempt < existing.maxAttempts &&
        existing.policyDecision !== "blocked";
      if (!retryable) {
        emit({
          type: AUTOMATION_EVENTS.actionDuplicateSuppressed,
          moduleId: "automation",
          summary: "Duplicate agent action suppressed",
          payload: {
            actionId: existing.id,
            runId: run.id,
            correlationId: run.correlationId,
            actionType: existing.actionType,
            idempotencyKey,
          },
        });
        return existing;
      }
      const retried = this.putAction({
        ...existing,
        attempt: existing.attempt + 1,
        executionState: "not_executed",
        errorCode: undefined,
        errorMessage: undefined,
        runId: run.id,
        correlationId: run.correlationId,
        updatedAt: Date.now(),
      });
      emit({
        type: AUTOMATION_EVENTS.actionRetried,
        moduleId: "automation",
        summary: `Agent action retried (attempt ${retried.attempt})`,
        payload: {
          actionId: retried.id,
          runId: run.id,
          correlationId: run.correlationId,
          actionType: retried.actionType,
          attempt: retried.attempt,
          maxAttempts: retried.maxAttempts,
        },
      });
      return retried;
    }

    // ---- policy (authoritative, re-derived, never trusted from input) ----
    const verdict = decideActionPolicy(input.actionType, rule?.approvalPolicy);

    // An agent may only exercise capabilities it was explicitly granted.
    const missing = verdict.capabilityIds.filter(
      (c) => !agent.allowedCapabilityIds.includes(c),
    );
    let decision = verdict.decision;
    let reason = verdict.reason;
    if (missing.length && decision !== "blocked") {
      decision = "blocked";
      reason = `Agent "${agent.name}" was not granted: ${missing.join(", ")}.`;
    }

    const now = Date.now();
    const action: AgentAction = {
      id: newId(),
      runId: run.id,
      agentId: agent.id,
      automationRuleId: run.automationRuleId,
      correlationId: run.correlationId,
      actionType: input.actionType,
      policyDecision: decision,
      policyReason: reason,
      targets: input.targets.map((t) => ({ ...t })),
      rationale,
      requestedCapabilityIds: verdict.capabilityIds,
      approvalState:
        decision === "approval_required" ? "pending" : "not_required",
      executionState: decision === "blocked" ? "blocked" : "not_executed",
      idempotencyKey,
      attempt: 1,
      maxAttempts: rule?.executionPolicy.maxAttempts ?? 1,
      createdAt: now,
      updatedAt: now,
    };

    let approval: Approval | undefined;
    if (decision === "approval_required") {
      approval = {
        id: newId(),
        actionId: action.id,
        runId: run.id,
        requestedAt: now,
        requestedBy: getIdentity().id,
      };
      action.approvalId = approval.id;
    }

    // ---- persist (both collections, approval first so an action never
    //      references a missing approval record) ---------------------------
    if (approval) this.commit(K_APPROVALS, [...this.approvals(), approval]);
    this.commit(K_ACTIONS, [...this.actions(), action]);
    this.putRun({
      ...run,
      actionCount: this.actions().filter((a) => a.runId === run.id).length,
    });

    // ---- emit -------------------------------------------------------------
    emit({
      type: AUTOMATION_EVENTS.actionRequested,
      moduleId: "automation",
      summary: `Agent action requested: ${action.actionType}`,
      payload: {
        actionId: action.id,
        runId: run.id,
        agentId: agent.id,
        correlationId: run.correlationId,
        actionType: action.actionType,
        policyDecision: action.policyDecision,
        requestedCapabilityIds: action.requestedCapabilityIds,
        targetCount: action.targets.length,
        idempotencyKey,
      },
    });
    if (decision === "blocked") {
      emit({
        type: AUTOMATION_EVENTS.actionBlocked,
        moduleId: "automation",
        summary: `Agent action blocked: ${action.actionType}`,
        payload: {
          actionId: action.id,
          runId: run.id,
          correlationId: run.correlationId,
          reason: action.policyReason,
        },
      });
    }
    if (approval) {
      emit({
        type: AUTOMATION_EVENTS.actionApprovalRequested,
        moduleId: "automation",
        summary: `Approval requested: ${action.actionType}`,
        payload: {
          approvalId: approval.id,
          actionId: action.id,
          runId: run.id,
          correlationId: run.correlationId,
          requestedBy: approval.requestedBy,
        },
      });
    }

    return action;
  }

  // ---- Approvals ---------------------------------------------------------------
  async listApprovals(state?: "pending" | "decided"): Promise<Approval[]> {
    const rows = this.approvals().sort((a, b) => b.requestedAt - a.requestedAt);
    if (!state) return rows;
    return rows.filter((a) => {
      const decided = a.approvedAt !== undefined || a.rejectedAt !== undefined;
      return state === "pending" ? !decided : decided;
    });
  }

  async getApproval(id: string): Promise<Approval | undefined> {
    return this.approvals().find((a) => a.id === id);
  }

  private decide(
    actionId: string,
    approved: boolean,
    reason?: string,
  ): AgentAction {
    const action = this.actions().find((a) => a.id === actionId);
    if (!action) {
      throw new Error(`Automation: no action with id "${actionId}".`);
    }
    if (action.policyDecision === "blocked") {
      throw new Error(
        "Automation: a blocked action can never be approved — it is not permitted at all.",
      );
    }
    if (action.approvalState !== "pending") {
      throw new Error(
        `Automation: action approval is "${action.approvalState}" and cannot be decided again.`,
      );
    }
    const approvals = this.approvals();
    const idx = approvals.findIndex((a) => a.id === action.approvalId);
    if (idx === -1) {
      throw new Error(
        "Automation: the action has no approval record; refusing to decide.",
      );
    }
    const now = Date.now();
    const who = getIdentity().id;
    const nextApproval: Approval = approved
      ? { ...approvals[idx]!, approvedAt: now, approvedBy: who, reason }
      : { ...approvals[idx]!, rejectedAt: now, rejectedBy: who, reason };
    const copy = [...approvals];
    copy[idx] = nextApproval;
    this.commit(K_APPROVALS, copy);

    const nextAction = this.putAction({
      ...action,
      approvalState: approved ? "approved" : "rejected",
      executionState: approved ? action.executionState : "cancelled",
      updatedAt: now,
    });

    emit({
      type: approved
        ? AUTOMATION_EVENTS.actionApproved
        : AUTOMATION_EVENTS.actionRejected,
      moduleId: "automation",
      summary: `Agent action ${approved ? "approved" : "rejected"}: ${nextAction.actionType}`,
      payload: {
        actionId: nextAction.id,
        approvalId: nextApproval.id,
        runId: nextAction.runId,
        correlationId: nextAction.correlationId,
        decidedBy: who,
      },
    });
    return nextAction;
  }

  async approveAction(actionId: string, reason?: string): Promise<AgentAction> {
    return this.decide(actionId, true, reason?.trim() || undefined);
  }

  async rejectAction(actionId: string, reason?: string): Promise<AgentAction> {
    return this.decide(actionId, false, reason?.trim() || undefined);
  }

  // ---- Execution results ----------------------------------------------------------
  /**
   * The gate. Re-derives every requirement rather than trusting the stored
   * record, so an action cannot be marked executed by flipping a flag:
   *   • blocked actions can never execute
   *   • approval-required actions must carry a real, approved Approval
   *   • an already-executed action cannot execute twice
   */
  private assertExecutable(action: AgentAction): void {
    if (action.policyDecision === "blocked") {
      throw new Error(
        `Automation: "${action.actionType}" is blocked by policy and can never be executed.`,
      );
    }
    if (action.executionState === "executed") {
      throw new Error(
        "Automation: this action already executed; it will not execute twice.",
      );
    }
    if (action.executionState === "cancelled") {
      throw new Error("Automation: this action was cancelled.");
    }
    const verdict = decideActionPolicy(action.actionType);
    const needsApproval =
      verdict.decision === "approval_required" ||
      action.policyDecision === "approval_required";
    if (needsApproval) {
      if (action.approvalState !== "approved") {
        throw new Error(
          `Automation: "${action.actionType}" requires human approval before it can execute.`,
        );
      }
      const approval = this.approvals().find((a) => a.id === action.approvalId);
      if (!approval?.approvedAt) {
        throw new Error(
          "Automation: no approved approval record backs this action.",
        );
      }
    }
  }

  async markActionExecuted(
    actionId: string,
    resultSummary: string,
  ): Promise<AgentAction> {
    const action = this.actions().find((a) => a.id === actionId);
    if (!action) {
      throw new Error(`Automation: no action with id "${actionId}".`);
    }
    this.assertExecutable(action);
    const summary = text(resultSummary, "a result summary");
    const now = Date.now();
    const next = this.putAction({
      ...action,
      executionState: "executed",
      resultSummary: summary,
      errorCode: undefined,
      errorMessage: undefined,
      executedAt: now,
      updatedAt: now,
    });
    emit({
      type: AUTOMATION_EVENTS.actionExecuted,
      moduleId: "automation",
      summary: `Agent action executed: ${next.actionType}`,
      payload: {
        actionId: next.id,
        runId: next.runId,
        agentId: next.agentId,
        correlationId: next.correlationId,
        actionType: next.actionType,
        attempt: next.attempt,
        result: summary,
      },
    });
    return next;
  }

  async markActionFailed(
    actionId: string,
    error: { code: string; message: string },
  ): Promise<AgentAction> {
    const action = this.actions().find((a) => a.id === actionId);
    if (!action) {
      throw new Error(`Automation: no action with id "${actionId}".`);
    }
    if (action.executionState === "executed") {
      throw new Error(
        "Automation: an executed action cannot be re-recorded as failed.",
      );
    }
    const now = Date.now();
    const next = this.putAction({
      ...action,
      executionState: "failed",
      errorCode: error.code,
      errorMessage: error.message,
      updatedAt: now,
    });
    emit({
      type: AUTOMATION_EVENTS.actionFailed,
      moduleId: "automation",
      summary: `Agent action failed: ${next.actionType}`,
      payload: {
        actionId: next.id,
        runId: next.runId,
        correlationId: next.correlationId,
        actionType: next.actionType,
        attempt: next.attempt,
        maxAttempts: next.maxAttempts,
        errorCode: error.code,
      },
    });
    return next;
  }

  // ---- Read model -------------------------------------------------------------------
  async getOverview(now: number = Date.now()): Promise<AutomationOverview> {
    const runs = this.runs();
    const dayStart = startOfDay(now);
    return {
      activeAgents: this.agents().filter((a) => a.status === "active").length,
      activeAutomations: this.rules().filter((r) => r.enabled).length,
      pendingApprovals: this.actions().filter(
        (a) => a.approvalState === "pending",
      ).length,
      failedRuns: runs.filter((r) => r.status === "failed").length,
      completedRunsToday: runs.filter(
        (r) =>
          r.status === "succeeded" &&
          r.completedAt !== undefined &&
          r.completedAt >= dayStart,
      ).length,
      blockedActions: this.actions().filter(
        (a) => a.executionState === "blocked",
      ).length,
      runningRuns: runs.filter((r) => r.status === "running").length,
    };
  }
}

/**
 * Factory. The capability boundary is applied HERE, not at registration, so
 * it holds however the implementation is obtained — UI, agent, adapter,
 * scheduled worker or test.
 *
 * Reads stay ungated at this layer (read gating lives in the UI and in the
 * Jarvis tool layer, per Phase 12.2).
 */
export function createLocalAutomationRepository(): AutomationRepository {
  const instance = new LocalAutomationRepository();
  // `withCapabilityEnforcement` walks OWN enumerable properties, so the
  // class instance is first flattened into a plain object holding exactly
  // the public interface, bound to the instance. Nothing private leaks out.
  const PUBLIC_METHODS = [
    "listAgents", "getAgent", "createAgent", "updateAgent", "setAgentEnabled",
    "listRules", "getRule", "createRule", "updateRule", "setRuleEnabled",
    "listRuns", "getRun", "startRun", "completeRun",
    "listActions", "getAction", "findActionByIdempotencyKey", "requestAction",
    "listApprovals", "getApproval", "approveAction", "rejectAction",
    "markActionExecuted", "markActionFailed",
    "getOverview", "subscribe",
  ] as const;
  const impl = Object.fromEntries(
    PUBLIC_METHODS.map((name) => [
      name,
      (instance[name] as (...args: never[]) => unknown).bind(instance),
    ]),
  ) as unknown as AutomationRepository;

  return withCapabilityEnforcement<AutomationRepository>(
    impl,
    {

      createAgent: AGENTS_WRITE,
      updateAgent: AGENTS_WRITE,
      setAgentEnabled: AGENTS_WRITE,

      createRule: AGENTS_MANAGE,
      updateRule: AGENTS_MANAGE,
      setRuleEnabled: AGENTS_MANAGE,

      startRun: AGENTS_RUN,
      completeRun: AGENTS_RUN,
      requestAction: AGENTS_RUN,
      markActionExecuted: AGENTS_RUN,
      markActionFailed: AGENTS_RUN,

      approveAction: AGENTS_APPROVE,
      rejectAction: AGENTS_APPROVE,
    },
  );
}

/** Re-exported for the catalogue-driven UI. */
export { ACTION_CATALOGUE };
