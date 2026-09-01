// Controlled execution boundary (Phase 13).
//
//   OBSERVE → UNDERSTAND → PROPOSE → AUTHORIZE → EXECUTE → VERIFY → RECORD
//
// Read that as a fixed pipeline, not a suggestion:
//
//   observe    an observer reads other modules through PUBLIC contracts
//   understand the rule's conditions are evaluated against scalar values
//   propose    `requestAction` records WHAT the agent wants to do
//   authorize  the repository applies the centralised policy + capability
//              enforcement — before anything is mutated
//   execute    a handler performs a REAL operation, only when policy says
//              auto_execute, or when a real human approval exists
//   verify     the handler's return value is the evidence; a throw is a
//              failure and is recorded as one
//   record     durable action state + immutable, causally ordered events
//
// The executor itself holds no privileges. Every gate lives in the
// repository, so a future driver (worker, n8n, model) calling the same
// methods gets exactly the same treatment.

import { getRepository, hasRepository } from "@/core/data/registry";
import {
  AUTOMATION_REPOSITORY,
  type AutomationRepository,
} from "../data/repository";
import type {
  AgentAction,
  AgentRun,
  AutomationRule,
  RunTriggerInfo,
} from "../data/schemas";
import { getActionHandler } from "./handlers";
import { getObserver, DAY_MS, type Observation } from "./observers";
import { evaluateConditions, manualTrigger, triggerMatches } from "./triggers";

export interface RunOptions {
  now?: number;
  trigger?: RunTriggerInfo;
  /** How old a record must be before an observer reports it. */
  staleAfterMs?: number;
  /** Safety valve: never fan out unboundedly on the first run. */
  maxActions?: number;
}

export interface RunReport {
  run: AgentRun;
  actions: AgentAction[];
  executed: number;
  awaitingApproval: number;
  blocked: number;
  failed: number;
  duplicatesSuppressed: number;
}

function repo(): AutomationRepository {
  if (!hasRepository(AUTOMATION_REPOSITORY)) {
    throw new Error("Automation: the automation repository is not registered.");
  }
  return getRepository<AutomationRepository>(AUTOMATION_REPOSITORY);
}

/**
 * Idempotency key. Same rule + action type + subject inside the same window
 * is ONE action, however many times the trigger fires or the process
 * restarts.
 */
export function idempotencyKey(opts: {
  ruleId?: string;
  agentId: string;
  actionType: string;
  subject: string;
  now: number;
  windowMs: number;
}): string {
  const bucket = Math.floor(opts.now / Math.max(1, opts.windowMs));
  return [
    opts.ruleId ?? `agent:${opts.agentId}`,
    opts.actionType,
    opts.subject,
    `w${bucket}`,
  ].join("|");
}

/**
 * Execute one already-authorized action.
 *
 * The repository is the gate: `markActionExecuted` re-derives the approval
 * requirement and refuses a blocked, unapproved or already-executed action.
 * The handler runs FIRST, and its state is recorded only after it returns —
 * so nothing is ever marked executed unless the underlying operation
 * actually succeeded.
 */
export async function executeAction(
  actionId: string,
  now = Date.now(),
): Promise<AgentAction> {
  const r = repo();
  const action = await r.getAction(actionId);
  if (!action) throw new Error(`Automation: no action with id "${actionId}".`);

  if (action.policyDecision === "blocked") {
    throw new Error(
      `Automation: "${action.actionType}" is blocked by policy and is never executed.`,
    );
  }
  if (
    action.policyDecision === "approval_required" &&
    action.approvalState !== "approved"
  ) {
    throw new Error(
      `Automation: "${action.actionType}" is awaiting human approval.`,
    );
  }

  const handler = getActionHandler(action.actionType);
  if (!handler) {
    return r.markActionFailed(actionId, {
      code: "no_handler",
      message: `No handler is registered for "${action.actionType}". Nothing was attempted.`,
    });
  }

  try {
    const result = await handler({ action, now });
    return await r.markActionExecuted(actionId, result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return r.markActionFailed(actionId, { code: "handler_failed", message });
  }
}

/** Execute every approved-but-not-yet-executed action of a run. */
export async function executeApprovedActions(
  runId: string,
  now = Date.now(),
): Promise<AgentAction[]> {
  const r = repo();
  const actions = await r.listActions({ runId });
  const out: AgentAction[] = [];
  for (const a of actions) {
    if (a.executionState !== "not_executed") continue;
    if (a.policyDecision === "blocked") continue;
    if (a.policyDecision === "approval_required" && a.approvalState !== "approved") {
      continue;
    }
    out.push(await executeAction(a.id, now));
  }
  return out;
}

/**
 * Run one automation rule end to end.
 *
 * A rule whose trigger does not match, or whose agent/rule is disabled, does
 * not run at all — `startRun` refuses it, which is the point: "switched off"
 * has to mean something at the boundary, not in the UI.
 */
export async function runAutomationRule(
  ruleId: string,
  options: RunOptions = {},
): Promise<RunReport> {
  const r = repo();
  const now = options.now ?? Date.now();
  const trigger = options.trigger ?? manualTrigger();
  const rule = await r.getRule(ruleId);
  if (!rule) throw new Error(`Automation: no rule with id "${ruleId}".`);
  if (!triggerMatches(rule.trigger, trigger)) {
    throw new Error(
      `Automation: rule "${rule.name}" is not triggered by ${trigger.source}.`,
    );
  }

  const run = await r.startRun({
    agentId: rule.agentId,
    automationRuleId: rule.id,
    trigger,
  });

  const report: RunReport = {
    run,
    actions: [],
    executed: 0,
    awaitingApproval: 0,
    blocked: 0,
    failed: 0,
    duplicatesSuppressed: 0,
  };

  try {
    // ---- OBSERVE ---------------------------------------------------------
    const observations = await observe(rule, {
      now,
      staleAfterMs: options.staleAfterMs ?? 7 * DAY_MS,
      limit: options.maxActions ?? 25,
    });

    // ---- UNDERSTAND ------------------------------------------------------
    const eligible = observations.filter((o) =>
      evaluateConditions(rule.conditions, o.values, now),
    );

    const seen = new Set<string>();
    for (const o of eligible) {
      const key = idempotencyKey({
        ruleId: rule.id,
        agentId: rule.agentId,
        actionType: rule.proposedActionType,
        subject: o.subject,
        now,
        windowMs: rule.executionPolicy.idempotencyWindowMs,
      });

      // ---- PROPOSE + AUTHORIZE (both inside the repository) --------------
      const before = await r.findActionByIdempotencyKey(key);
      const action = await r.requestAction({
        runId: run.id,
        actionType: rule.proposedActionType,
        targets: o.targets,
        rationale: o.rationale,
        idempotencyKey: key,
      });
      if (before && before.executionState !== "failed") {
        report.duplicatesSuppressed += 1;
        if (!seen.has(action.id)) report.actions.push(action);
        seen.add(action.id);
        continue;
      }
      seen.add(action.id);

      // ---- EXECUTE + VERIFY + RECORD -------------------------------------
      let finalAction = action;
      if (action.policyDecision === "auto_execute") {
        finalAction = await executeAction(action.id, now);
      }
      report.actions.push(finalAction);
      if (finalAction.executionState === "executed") report.executed += 1;
      else if (finalAction.executionState === "failed") report.failed += 1;
      else if (finalAction.executionState === "blocked") report.blocked += 1;
      else if (finalAction.approvalState === "pending") {
        report.awaitingApproval += 1;
      }
    }

    const status =
      report.failed > 0
        ? "failed"
        : report.awaitingApproval > 0
          ? "awaiting_approval"
          : report.blocked > 0 && report.executed === 0
            ? "blocked"
            : "succeeded";

    report.run = await r.completeRun(run.id, status, {
      outcome:
        `${report.actions.length} action(s): ${report.executed} executed, ` +
        `${report.awaitingApproval} awaiting approval, ${report.blocked} blocked, ` +
        `${report.failed} failed, ${report.duplicatesSuppressed} duplicate(s) suppressed.`,
    });
    return report;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    report.run = await r.completeRun(run.id, "failed", {
      errorCode: "run_failed",
      errorMessage: message,
      outcome: "The run stopped on an error; see errorMessage.",
    });
    throw e;
  }
}

async function observe(
  rule: AutomationRule,
  ctx: { now: number; staleAfterMs: number; limit: number },
): Promise<Observation[]> {
  const observer = getObserver(rule.trigger.observerId);
  if (!observer) return [];
  return observer(ctx);
}
