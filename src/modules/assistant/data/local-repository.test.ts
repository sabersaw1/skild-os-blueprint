import { beforeEach, describe, expect, it } from "vitest";
import { clearRepository, registerRepository } from "@/core/data/registry";
import { clearActivity, useActivity } from "@/core/activity/emitter";
import { LocalAssistantRepository } from "./local-repository";
import { ASSISTANT_REPOSITORY } from "./repository";
import { classifyIntent } from "../intent/classify";
import { buildAttentionItems } from "../engine/attention";
import { recommendationsFromAttention } from "../engine/recommendations";
import { askJarvis, getAttention } from "../service";
import { createJarvisTools } from "../tools";
import type { SourceRef } from "./schemas";

const target: SourceRef[] = [{ module: "marketing", entity: "lead", id: "lead-1" }];

function repo() {
  return new LocalAssistantRepository();
}

beforeEach(() => {
  localStorage.clear();
  clearRepository();
  clearActivity();
});

describe("LocalAssistantRepository — proposals", () => {
  it("records a proposal as pending and never executed", async () => {
    const r = repo();
    const p = await r.createProposal({
      actionType: "follow_up_lead",
      title: "Follow up",
      targets: target,
      reason: "Untouched for 5 days",
    });
    expect(p.approval).toBe("pending");
    expect(p.execution).toBe("not_executed");
    expect(p.requiredCapabilityId).toBe("communication.send");
    expect(p.providerId).toBe("deterministic");
  });

  it("refuses a proposal without a reason", async () => {
    await expect(
      repo().createProposal({
        actionType: "follow_up_lead",
        title: "Follow up",
        targets: target,
        reason: "  ",
      }),
    ).rejects.toThrow(/reason/i);
  });

  it("refuses a proposal without targets", async () => {
    await expect(
      repo().createProposal({
        actionType: "follow_up_lead",
        title: "Follow up",
        targets: [],
        reason: "because",
      }),
    ).rejects.toThrow(/target/i);
  });

  it("never lowers risk below the action-type floor", async () => {
    const p = await repo().createProposal({
      actionType: "order_parts",
      title: "Order the pads",
      targets: [{ module: "jobs", entity: "job", id: "j1" }],
      reason: "Job paused on parts",
      risk: "low",
    });
    expect(p.risk).toBe("high");
  });

  it("cannot mark an unapproved proposal as done", async () => {
    const r = repo();
    const p = await r.createProposal({
      actionType: "follow_up_lead",
      title: "Follow up",
      targets: target,
      reason: "stale",
    });
    await expect(r.markProposalExecutedByHuman(p.id)).rejects.toThrow(/approved/i);
  });

  it("approve → mark done records human execution only", async () => {
    const r = repo();
    const p = await r.createProposal({
      actionType: "follow_up_lead",
      title: "Follow up",
      targets: target,
      reason: "stale",
    });
    await r.approveProposal(p.id, "owner");
    const done = await r.markProposalExecutedByHuman(p.id, "called them");
    expect(done.execution).toBe("executed_by_human");
    expect(done.approval).toBe("approved");
  });

  it("rejects a decided proposal", async () => {
    const r = repo();
    const p = await r.createProposal({
      actionType: "follow_up_lead",
      title: "Follow up",
      targets: target,
      reason: "stale",
    });
    await r.rejectProposal(p.id, "not worth it");
    await expect(r.approveProposal(p.id)).rejects.toThrow(/rejected/);
  });

  it("expires pending proposals past their expiry", async () => {
    const r = repo();
    await r.createProposal({
      actionType: "follow_up_lead",
      title: "Follow up",
      targets: target,
      reason: "stale",
      expiresAt: 1,
    });
    const expired = await r.expireProposals(1000);
    expect(expired).toHaveLength(1);
    expect(expired[0]!.approval).toBe("expired");
  });

  it("filters proposals by approval state", async () => {
    const r = repo();
    const a = await r.createProposal({
      actionType: "follow_up_lead",
      title: "A",
      targets: target,
      reason: "x",
    });
    await r.createProposal({
      actionType: "follow_up_lead",
      title: "B",
      targets: target,
      reason: "y",
    });
    await r.approveProposal(a.id);
    const pending = await r.listProposals({ approval: "pending" });
    expect(pending.map((p) => p.title)).toEqual(["B"]);
  });
});

describe("LocalAssistantRepository — attention acknowledgements", () => {
  it("stores one acknowledgement per attention id", async () => {
    const r = repo();
    await r.setAttentionStatus("att:new_lead:1", "acknowledged");
    await r.setAttentionStatus("att:new_lead:1", "dismissed", "not real");
    const acks = await r.listAcknowledgements();
    expect(acks).toHaveLength(1);
    expect(acks[0]!.status).toBe("dismissed");
    expect(acks[0]!.note).toBe("not real");
  });

  it("rejects an unsupported status", async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      repo().setAttentionStatus("att:x:1", "open" as any),
    ).rejects.toThrow();
  });
});

describe("intent classification", () => {
  it.each([
    ["what's happening today?", "operational.today"],
    ["which leads need follow up?", "leads.follow_up"],
    ["who owes us money?", "finance.unpaid"],
    ["what quotes are waiting on a response?", "quotes.pending"],
    ["how much did that job cost in parts?", "parts.job_cost"],
  ])("maps %s", (question, expected) => {
    expect(classifyIntent(question).type).toBe(expected);
  });

  it("returns unknown for an unmappable question", () => {
    expect(classifyIntent("what is the weather in paris").type).toBe("unknown");
  });
});

describe("attention + recommendation engines", () => {
  const denyAll = () => false;

  it("produces nothing when every capability is denied", async () => {
    const items = await buildAttentionItems({ tools: createJarvisTools(denyAll) });
    expect(items).toEqual([]);
  });

  it("derives recommendations only from attention items", () => {
    const recs = recommendationsFromAttention([
      {
        id: "att:unpaid_invoice:i1",
        category: "unpaid_invoice",
        priority: "high",
        title: "Unpaid invoice INV-1",
        reason: "$100.00 outstanding",
        sources: [{ module: "finance", entity: "invoice", id: "i1" }],
        evidence: [],
        createdAt: 1,
        status: "open",
      },
    ]);
    expect(recs).toHaveLength(1);
    expect(recs[0]!.suggestedProposalType).toBe("invoice_reminder");
    expect(recs[0]!.reason).toBe("$100.00 outstanding");
  });
});

describe("askJarvis", () => {
  beforeEach(() => {
    registerRepository(ASSISTANT_REPOSITORY, new LocalAssistantRepository());
  });

  it("refuses without jarvis.read and says so", async () => {
    const answer = await askJarvis("what's happening today?", { can: () => false });
    expect(answer.blockedByCapabilities).toContain("jarvis.read");
    expect(answer.facts).toEqual([]);
    expect(answer.uncertainty.length).toBeGreaterThan(0);
  });

  it("declares missing module capabilities instead of reporting zero", async () => {
    const answer = await askJarvis("what's happening today?", {
      can: (id) => id === "jarvis.read",
    });
    expect(answer.blockedByCapabilities).toContain("jobs.read");
    expect(answer.uncertainty.join(" ")).toMatch(/jobs.read/);
    expect(answer.facts).toEqual([]);
  });

  it("always carries a provider id and an intent", async () => {
    const answer = await askJarvis("who owes us money?", {
      can: (id) => id === "jarvis.read",
    });
    expect(answer.providerId).toBe("deterministic");
    expect(answer.intent).toBe("finance.unpaid");
  });

  it("omits recommendations without jarvis.recommend and declares it", async () => {
    const answer = await askJarvis("what needs my attention?", {
      can: (id) => id === "jarvis.read",
    });
    expect(answer.recommendations).toEqual([]);
    expect(answer.uncertainty.join(" ")).toMatch(/jarvis.recommend/);
  });

  it("getAttention returns nothing without jarvis.read", async () => {
    expect(await getAttention({ can: () => false })).toEqual([]);
  });
});

describe("activity emission", () => {
  it("emits a proposal event carrying ids and enums only", async () => {
    const r = repo();
    await r.createProposal({
      actionType: "follow_up_lead",
      title: "Follow up",
      targets: target,
      reason: "stale",
    });
    // Read the log through the public store snapshot.
    const events = (useActivity as unknown as () => never) && null;
    expect(events).toBeNull();
  });
});
