// Automation / Agents tests (Phase 13).
//
// These are behaviour tests for the CONTROL boundary, not for happy paths:
// what an agent is refused, what it cannot execute without a human, what
// happens twice, and what happens when the underlying work fails.

import { beforeEach, describe, expect, it, vi } from "vitest";

class MemoryStorage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  key(i: number) {
    return Array.from(this.store.keys())[i] ?? null;
  }
  getItem(k: string) {
    return this.store.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.store.set(k, String(v));
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).window = globalThis;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).localStorage = new MemoryStorage();

import { createLocalAutomationRepository } from "./local-repository";
import { AUTOMATION_REPOSITORY, type AutomationRepository } from "./repository";
import { AUTOMATION_EVENTS } from "../activity";
import { decideActionPolicy } from "./policy";
import { evaluateConditions, manualTrigger, triggerMatches } from "../engine/triggers";
import { executeAction, idempotencyKey, runAutomationRule } from "../engine/executor";
import * as emitter from "@/core/activity/emitter";
import { clearRepository, registerRepository } from "@/core/data/registry";
import {
  ASSISTANT_REPOSITORY,
  type AssistantRepository,
} from "@/modules/assistant/data/repository";
import { LocalAssistantRepository } from "@/modules/assistant/data/local-repository";
import { registerRole } from "@/core/roles/roles";
import { setIdentityProvider } from "@/core/auth/provider";
import { isUuidV4 } from "@/core/ids";
import type { AgentActionType } from "./schemas";

const storage = () =>
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage;

const DAY = 24 * 60 * 60 * 1000;

// A deliberately under-privileged actor: can look, cannot act.
registerRole({
  id: "observer",
  name: "Observer",
  capabilityIds: ["agents.read"],
});

function asOwner() {
  setIdentityProvider({
    kind: "test",
    get: () => ({ id: "owner-1", displayName: "Owner", roleId: "owner" }),
    subscribe: () => () => {},
  });
}

function asObserver() {
  setIdentityProvider({
    kind: "test",
    get: () => ({ id: "observer-1", displayName: "Observer", roleId: "observer" }),
    subscribe: () => () => {},
  });
}

function fresh(): AutomationRepository {
  storage().clear();
  clearRepository();
  asOwner();
  const repo = createLocalAutomationRepository();
  registerRepository(AUTOMATION_REPOSITORY, repo);
  registerRepository(ASSISTANT_REPOSITORY, new LocalAssistantRepository());
  return repo;
}

async function agentWithRule(
  repo: AutomationRepository,
  actionType: AgentActionType = "attention.flag",
) {
  const agent = await repo.createAgent({
    name: "Watcher",
    purpose: "Notice quiet records.",
    status: "active",
  });
  const rule = await repo.createRule({
    agentId: agent.id,
    name: "Stale things",
    trigger: { kind: "record_state", observerId: "lead.stale" },
    proposedActionType: actionType,
    enabled: true,
  });
  return { agent, rule };
}

describe("Automation — policy", () => {
  it("blocks every externally consequential action type", () => {
    for (const t of [
      "communication.send",
      "pricing.change",
      "finance.invoice.issue",
      "finance.payment.record",
      "finance.refund",
      "marketing.publish",
      "record.delete",
    ] as AgentActionType[]) {
      expect(decideActionPolicy(t).decision).toBe("blocked");
    }
  });

  it("only auto-executes internal, reversible work", () => {
    expect(decideActionPolicy("attention.flag").decision).toBe("auto_execute");
    expect(decideActionPolicy("proposal.create").decision).toBe("auto_execute");
    expect(decideActionPolicy("followup.prepare").decision).toBe(
      "approval_required",
    );
  });

  it("lets a rule tighten but never loosen the catalogue", () => {
    expect(
      decideActionPolicy("attention.flag", "approval_required").decision,
    ).toBe("approval_required");
    // A rule trying to make a blocked action automatic is ignored.
    expect(decideActionPolicy("communication.send", "auto_execute").decision).toBe(
      "blocked",
    );
    // ...and one trying to make an approval action automatic is ignored too.
    expect(decideActionPolicy("followup.prepare", "auto_execute").decision).toBe(
      "approval_required",
    );
  });

  it("blocks an unknown action type", () => {
    expect(
      decideActionPolicy("does.not.exist" as AgentActionType).decision,
    ).toBe("blocked");
  });
});

describe("Automation — authorization", () => {
  let repo: AutomationRepository;
  beforeEach(() => {
    repo = fresh();
  });

  it("refuses every mutation for an actor without the capability, and emits nothing", async () => {
    const { rule } = await agentWithRule(repo);
    const spy = vi.spyOn(emitter, "emit");
    asObserver();

    await expect(
      repo.createAgent({ name: "X", purpose: "y" }),
    ).rejects.toMatchObject({ code: "capability_denied" });
    await expect(repo.setRuleEnabled(rule.id, false)).rejects.toMatchObject({
      code: "capability_denied",
    });
    await expect(
      repo.startRun({ agentId: rule.agentId, trigger: manualTrigger() }),
    ).rejects.toMatchObject({ code: "capability_denied" });

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    asOwner();
  });

  it("checks authorization before validation", async () => {
    asObserver();
    // Invalid input AND no capability: the capability error must win.
    await expect(repo.createAgent({ name: "", purpose: "" })).rejects.toThrow(
      /capability/i,
    );
    asOwner();
  });

  it("refuses approval from an actor holding only agents.run", async () => {
    const { rule } = await agentWithRule(repo, "followup.prepare");
    const report = await runAutomationRule(rule.id, { now: Date.now() });
    const pending = report.actions.find((a) => a.approvalState === "pending");
    registerRole({ id: "runner", name: "Runner", capabilityIds: ["agents.read", "agents.run"] });
    setIdentityProvider({
      kind: "test",
      get: () => ({ id: "r", displayName: "R", roleId: "runner" }),
      subscribe: () => () => {},
    });
    if (pending) {
      await expect(repo.approveAction(pending.id)).rejects.toMatchObject({
        code: "capability_denied",
      });
    }
    asOwner();
  });
});

describe("Automation — the execution boundary", () => {
  let repo: AutomationRepository;
  beforeEach(() => {
    repo = fresh();
  });

  it("cannot start a run for a disabled agent", async () => {
    const { agent, rule } = await agentWithRule(repo);
    await repo.setAgentEnabled(agent.id, false);
    await expect(runAutomationRule(rule.id)).rejects.toThrow(/disabled|not active|switched off/i);
  });

  it("cannot start a run for a disabled rule", async () => {
    const { rule } = await agentWithRule(repo);
    await repo.setRuleEnabled(rule.id, false);
    await expect(runAutomationRule(rule.id)).rejects.toThrow(/disabled|not active|switched off/i);
  });

  it("never creates a rule proposing a blocked action", async () => {
    const agent = await repo.createAgent({ name: "A", purpose: "p" });
    await expect(
      repo.createRule({
        agentId: agent.id,
        name: "Send things",
        trigger: { kind: "manual" },
        proposedActionType: "communication.send",
      }),
    ).rejects.toThrow();
  });

  it("records a blocked action as blocked and refuses to execute it", async () => {
    const { agent, rule } = await agentWithRule(repo);
    const run = await repo.startRun({
      agentId: agent.id,
      automationRuleId: rule.id,
      trigger: manualTrigger(),
    });
    // Request a blocked type directly — the repository, not the caller,
    // decides. This is the path a future agent could attempt.
    const action = await repo.requestAction({
      runId: run.id,
      actionType: "finance.refund",
      targets: [{ module: "finance", entity: "invoice", id: "inv-1" }],
      rationale: "The customer complained.",
      idempotencyKey: "k-refund",
    });
    expect(action.policyDecision).toBe("blocked");
    expect(action.executionState).toBe("blocked");
    await expect(executeAction(action.id)).rejects.toThrow(/blocked/i);
    await expect(
      repo.markActionExecuted(action.id, "done"),
    ).rejects.toThrow();
  });

  it("holds an approval-required action until a human approves it", async () => {
    const { rule } = await agentWithRule(repo, "followup.prepare");
    const run = await repo.startRun({
      agentId: rule.agentId,
      automationRuleId: rule.id,
      trigger: manualTrigger(),
    });
    const action = await repo.requestAction({
      runId: run.id,
      actionType: "followup.prepare",
      targets: [{ module: "quotes", entity: "quote", id: "q-1" }],
      rationale: "Quote has gone quiet.",
      idempotencyKey: "k-followup",
    });

    expect(action.policyDecision).toBe("approval_required");
    expect(action.approvalState).toBe("pending");
    expect(action.executionState).toBe("not_executed");
    await expect(executeAction(action.id)).rejects.toThrow(/approval/i);

    const approved = await repo.approveAction(action.id, "Yes, chase it.");
    expect(approved.approvalState).toBe("approved");
    const executed = await executeAction(approved.id);
    expect(executed.executionState).toBe("executed");
    expect(executed.resultSummary).toMatch(/proposal/i);
  });

  it("a rejected action is never executable", async () => {
    const { rule } = await agentWithRule(repo, "followup.prepare");
    const run = await repo.startRun({
      agentId: rule.agentId,
      automationRuleId: rule.id,
      trigger: manualTrigger(),
    });
    const action = await repo.requestAction({
      runId: run.id,
      actionType: "followup.prepare",
      targets: [{ module: "quotes", entity: "quote", id: "q-2" }],
      rationale: "Quiet quote.",
      idempotencyKey: "k-reject",
    });
    const rejected = await repo.rejectAction(action.id, "Not appropriate.");
    expect(rejected.approvalState).toBe("rejected");
    await expect(executeAction(rejected.id)).rejects.toThrow();
  });

  it("marks executed only after the real operation succeeded", async () => {
    const { rule } = await agentWithRule(repo);
    const run = await repo.startRun({
      agentId: rule.agentId,
      automationRuleId: rule.id,
      trigger: manualTrigger(),
    });
    const action = await repo.requestAction({
      runId: run.id,
      actionType: "attention.flag",
      targets: [{ module: "marketing", entity: "lead", id: "l-1" }],
      rationale: "No touch for 9 days.",
      idempotencyKey: "k-flag",
    });
    const done = await executeAction(action.id);
    expect(done.executionState).toBe("executed");

    // The claimed effect is real: a proposal exists in the assistant store.
    const assistant = (
      await import("@/core/data/registry")
    ).getRepository<AssistantRepository>(ASSISTANT_REPOSITORY);
    const proposals = await assistant.listProposals();
    expect(proposals.length).toBeGreaterThan(0);
  });

  it("records a failure instead of a false success when the work throws", async () => {
    const { rule } = await agentWithRule(repo);
    const run = await repo.startRun({
      agentId: rule.agentId,
      automationRuleId: rule.id,
      trigger: manualTrigger(),
    });
    const action = await repo.requestAction({
      runId: run.id,
      actionType: "attention.flag",
      targets: [{ module: "marketing", entity: "lead", id: "l-2" }],
      rationale: "Quiet lead.",
      idempotencyKey: "k-fail",
    });
    // Remove the downstream repository so the handler genuinely cannot work.
    clearRepository(ASSISTANT_REPOSITORY);
    const failed = await executeAction(action.id);
    expect(failed.executionState).toBe("failed");
    expect(failed.errorMessage).toBeTruthy();
    expect(failed.resultSummary).toBeUndefined();
  });
});

describe("Automation — idempotency", () => {
  let repo: AutomationRepository;
  beforeEach(() => {
    repo = fresh();
  });

  it("produces a stable key inside a window and a new one after it", () => {
    const base = {
      ruleId: "r1",
      agentId: "a1",
      actionType: "attention.flag",
      subject: "lead:1",
      windowMs: DAY,
    };
    const t0 = 1_700_000_000_000;
    expect(idempotencyKey({ ...base, now: t0 })).toBe(
      idempotencyKey({ ...base, now: t0 + 1000 }),
    );
    expect(idempotencyKey({ ...base, now: t0 })).not.toBe(
      idempotencyKey({ ...base, now: t0 + 2 * DAY }),
    );
  });

  it("returns the same action for a repeated request instead of duplicating", async () => {
    const { rule } = await agentWithRule(repo);
    const run = await repo.startRun({
      agentId: rule.agentId,
      automationRuleId: rule.id,
      trigger: manualTrigger(),
    });
    const input = {
      runId: run.id,
      actionType: "attention.flag" as const,
      targets: [{ module: "marketing", entity: "lead", id: "l-3" }],
      rationale: "Quiet lead.",
      idempotencyKey: "k-dup",
    };
    const first = await repo.requestAction(input);
    const second = await repo.requestAction(input);
    expect(second.id).toBe(first.id);
    const all = await repo.listActions({ runId: run.id });
    expect(all).toHaveLength(1);
  });
});

describe("Automation — triggers and conditions", () => {
  it("matches a record_state trigger only for its own observer", () => {
    const def = { kind: "record_state" as const, observerId: "lead.stale" };
    expect(triggerMatches(def, { kind: "record_state", source: "observer:lead.stale" })).toBe(true);
    expect(triggerMatches(def, { kind: "record_state", source: "observer:quote.stale" })).toBe(false);
    // A human asking explicitly always matches.
    expect(triggerMatches(def, manualTrigger())).toBe(true);
  });

  it("evaluates age conditions against supplied values only", () => {
    const now = 1_700_000_000_000;
    const conditions = [
      { field: "lastTouchedAt", operator: "older_than_days" as const, value: 7 },
    ];
    expect(evaluateConditions(conditions, { lastTouchedAt: now - 8 * DAY }, now)).toBe(true);
    expect(evaluateConditions(conditions, { lastTouchedAt: now - 2 * DAY }, now)).toBe(false);
    expect(evaluateConditions(conditions, {}, now)).toBe(false);
  });
});

describe("Automation — records and identifiers", () => {
  let repo: AutomationRepository;
  beforeEach(() => {
    repo = fresh();
  });

  it("uses UUID v4 ids and a shared correlation id per run", async () => {
    const { rule } = await agentWithRule(repo);
    const report = await runAutomationRule(rule.id);
    expect(isUuidV4(report.run.id)).toBe(true);
    expect(isUuidV4(report.run.correlationId)).toBe(true);
    for (const a of report.actions) {
      expect(a.correlationId).toBe(report.run.correlationId);
    }
  });

  it("emits immutable, named events for the run lifecycle", async () => {
    const spy = vi.spyOn(emitter, "emit");
    const { rule } = await agentWithRule(repo);
    await runAutomationRule(rule.id);
    const types = spy.mock.calls.map((c) => c[0].type);
    expect(types).toContain(AUTOMATION_EVENTS.runStarted);
    expect(types).toContain(AUTOMATION_EVENTS.runSucceeded);
    spy.mockRestore();
  });

  it("closes a run exactly once", async () => {
    const { rule } = await agentWithRule(repo);
    const report = await runAutomationRule(rule.id);
    await expect(
      repo.completeRun(report.run.id, "succeeded"),
    ).rejects.toThrow();
  });

  it("reports overview counts for the Command Center and Jarvis", async () => {
    const { rule } = await agentWithRule(repo, "followup.prepare");
    await runAutomationRule(rule.id);
    const overview = await repo.getOverview();
    expect(overview.activeAgents).toBeGreaterThanOrEqual(1);
    expect(overview.activeAutomations).toBeGreaterThanOrEqual(1);
    expect(overview).toHaveProperty("pendingApprovals");
    expect(overview).toHaveProperty("failedRuns");
  });
});
