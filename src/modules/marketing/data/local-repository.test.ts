// Unit + integration tests for the Marketing local repository (Phase 11).
// Same setup as the Communication / Finance suites: in-memory localStorage
// polyfill installed before importing the repository module.

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

import { createLocalMarketingRepository } from "./local-repository";
import { MARKETING_EVENTS } from "../activity";
import * as emitter from "@/core/activity/emitter";
import { clearRepository, registerRepository } from "@/core/data/registry";
import { type MarketingRepository } from "./repository";
import { isUuidV4 } from "@/core/ids";
import type { LeadCreateInput } from "./schemas";

const storage = () =>
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage;

function fresh(): MarketingRepository {
  storage().clear();
  clearRepository();
  return createLocalMarketingRepository();
}

const DAY = 24 * 60 * 60 * 1000;

function leadInput(over: Partial<LeadCreateInput> = {}): LeadCreateInput {
  return {
    channel: "website_form",
    serviceRequested: "Brake repair",
    attribution: { source: "website" },
    ...over,
  };
}

describe("marketing repository — leads", () => {
  let repo: MarketingRepository;
  beforeEach(() => {
    repo = fresh();
    vi.restoreAllMocks();
  });

  it("creates a lead with a uuid v4, new status, and seeded attribution", async () => {
    const lead = await repo.createLead(leadInput());
    expect(isUuidV4(lead.id)).toBe(true);
    expect(lead.status).toBe("new");
    expect(lead.awaitingParty).toBe("skild");
    expect(lead.attribution.firstTouch.source).toBe("website");
    expect(lead.attribution.lastTouch.source).toBe("website");
    expect(lead.attribution.firstTouch.at).toBe(lead.createdAt);
  });

  it("rejects a lead with no channel", async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      repo.createLead({ ...leadInput(), channel: "carrier_pigeon" as any }),
    ).rejects.toThrow(/channel/i);
  });

  it("rejects an invalid attribution source and persists nothing", async () => {
    await expect(
      repo.createLead(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        leadInput({ attribution: { source: "vibes" as any } }),
      ),
    ).rejects.toThrow(/source/i);
    expect(await repo.listLeads()).toHaveLength(0);
  });

  it("emits marketing.lead.created on creation", async () => {
    const spy = vi.spyOn(emitter, "emit");
    await repo.createLead(leadInput());
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ type: MARKETING_EVENTS.leadCreated }),
    );
  });

  it("scores a lead deterministically with reasons", async () => {
    const a = await repo.createLead(
      leadInput({ urgency: "emergency", customerId: "cust-1" }),
    );
    const b = await repo.createLead(leadInput({ urgency: "low" }));
    expect(a.score).toBeGreaterThan(b.score);
    expect(a.scoreReasons.length).toBeGreaterThan(0);
    const again = await repo.getLead(a.id);
    expect(again?.score).toBe(a.score);
  });

  it("allows a legal status transition and rejects an illegal one", async () => {
    const lead = await repo.createLead(leadInput());
    const contacted = await repo.setLeadStatus(lead.id, "contacted");
    expect(contacted.status).toBe("contacted");
    await expect(repo.setLeadStatus(lead.id, "won")).rejects.toThrow(
      /transition/i,
    );
  });

  it("treats won and lost as terminal", async () => {
    const lead = await repo.createLead(leadInput());
    await repo.setLeadStatus(lead.id, "qualifying");
    await repo.setLeadStatus(lead.id, "qualified");
    await repo.setLeadStatus(lead.id, "scheduled");
    const won = await repo.setLeadStatus(lead.id, "won");
    expect(won.status).toBe("won");
    await expect(repo.setLeadStatus(lead.id, "contacted")).rejects.toThrow();
  });

  it("derives awaitingParty from status", async () => {
    const lead = await repo.createLead(leadInput());
    const awaiting = await repo.setLeadStatus(lead.id, "awaiting_customer");
    expect(awaiting.awaitingParty).toBe("customer");
  });

  it("records a human contact without sending anything", async () => {
    const lead = await repo.createLead(leadInput());
    const at = Date.now();
    const touched = await repo.recordContact(lead.id, at);
    expect(touched.lastContactAt).toBe(at);
    expect(touched.firstResponseAt).toBe(at);
    const second = await repo.recordContact(lead.id, at + 1000);
    expect(second.firstResponseAt).toBe(at);
    expect(second.lastContactAt).toBe(at + 1000);
  });

  it("sets qualification and rejects an unknown value", async () => {
    const lead = await repo.createLead(leadInput());
    const q = await repo.setQualification(lead.id, "qualified");
    expect(q.qualification).toBe("qualified");
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      repo.setQualification(lead.id, "maybe" as any),
    ).rejects.toThrow(/qualification/i);
  });

  it("schedules and clears a follow-up", async () => {
    const lead = await repo.createLead(leadInput());
    const due = Date.now() + DAY;
    const scheduled = await repo.scheduleFollowUp(lead.id, due);
    expect(scheduled.nextFollowUpAt).toBe(due);
    const cleared = await repo.scheduleFollowUp(lead.id, null);
    expect(cleared.nextFollowUpAt).toBeUndefined();
  });

  it("records conversion ids without copying other modules' data", async () => {
    const lead = await repo.createLead(leadInput());
    const linked = await repo.recordConversion(lead.id, {
      quoteId: "q-1",
      jobId: "j-1",
      invoiceId: "inv-1",
    });
    expect(linked.quoteId).toBe("q-1");
    expect(linked.jobId).toBe("j-1");
    expect(linked.invoiceId).toBe("inv-1");
    expect(Object.keys(linked)).not.toContain("quote");
  });

  it("marks a lead lost with a reason", async () => {
    const lead = await repo.createLead(leadInput());
    const lost = await repo.markLost(lead.id, "price", "too expensive");
    expect(lost.status).toBe("lost");
    expect(lost.lostReason).toBe("price");
    expect(lost.lostDetail).toBe("too expensive");
  });

  it("rejects an unknown lost reason", async () => {
    const lead = await repo.createLead(leadInput());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(repo.markLost(lead.id, "vibes" as any)).rejects.toThrow();
  });

  it("records a later touch updating lastTouch only", async () => {
    const lead = await repo.createLead(leadInput());
    const touched = await repo.recordTouch(lead.id, { source: "referral" });
    expect(touched.attribution.firstTouch.source).toBe("website");
    expect(touched.attribution.lastTouch.source).toBe("referral");
  });

  it("is idempotent for an adapter replaying the same external ref", async () => {
    const a = await repo.createLead(
      leadInput({
        attribution: {
          source: "website",
          integrationId: "int-1",
          externalRef: "ext-1",
        },
      }),
    );
    const b = await repo.createLead(
      leadInput({
        attribution: {
          source: "website",
          integrationId: "int-1",
          externalRef: "ext-1",
        },
      }),
    );
    expect(b.id).toBe(a.id);
    expect(await repo.listLeads()).toHaveLength(1);
    expect(await repo.findLeadByExternalRef("int-1", "ext-1")).toBeTruthy();
  });

  it("links a lead to a Phase 10 service request and finds it back", async () => {
    const lead = await repo.createLead(
      leadInput({ serviceRequestId: "sr-1" }),
    );
    const found = await repo.findLeadByServiceRequest("sr-1");
    expect(found?.id).toBe(lead.id);
  });

  it("filters leads by status, source, and open-ness", async () => {
    const a = await repo.createLead(leadInput());
    await repo.createLead(leadInput({ attribution: { source: "referral" } }));
    await repo.markLost(a.id, "no_response");
    expect(await repo.listLeads({ source: "referral" })).toHaveLength(1);
    expect(await repo.listLeads({ status: "lost" })).toHaveLength(1);
    expect(await repo.listLeads({ open: true })).toHaveLength(1);
  });

  it("persists leads across repository instances", async () => {
    const lead = await repo.createLead(leadInput());
    const second = createLocalMarketingRepository();
    expect((await second.getLead(lead.id))?.id).toBe(lead.id);
  });

  it("throws for an unknown lead id", async () => {
    await expect(repo.setLeadStatus("nope", "contacted")).rejects.toThrow(
      /unknown/i,
    );
  });
});

describe("marketing repository — derived lead intelligence", () => {
  let repo: MarketingRepository;
  beforeEach(() => {
    repo = fresh();
  });

  it("flags a never-contacted lead", async () => {
    const lead = await repo.createLead(leadInput());
    const items = await repo.listLeadsNeedingAttention();
    const item = items.find((i) => i.leadId === lead.id);
    expect(item?.reasons).toContain("never_contacted");
  });

  it("flags an overdue follow-up", async () => {
    const lead = await repo.createLead(leadInput());
    await repo.recordContact(lead.id);
    await repo.scheduleFollowUp(lead.id, Date.now() - DAY);
    const items = await repo.listLeadsNeedingAttention();
    const item = items.find((i) => i.leadId === lead.id);
    expect(item?.reasons).toContain("follow_up_overdue");
  });

  it("never flags a closed lead", async () => {
    const lead = await repo.createLead(leadInput());
    await repo.markLost(lead.id, "no_response");
    const items = await repo.listLeadsNeedingAttention();
    expect(items.find((i) => i.leadId === lead.id)).toBeUndefined();
  });

  it("computes attention on read, storing nothing", async () => {
    const lead = await repo.createLead(leadInput());
    const stored = await repo.getLead(lead.id);
    expect(stored && "reasons" in stored).toBe(false);
  });

  it("reconstructs the lead chain from ids only", async () => {
    const lead = await repo.createLead(leadInput({ customerId: "cust-1" }));
    await repo.recordConversion(lead.id, { quoteId: "q-1", jobId: "j-1" });
    const chain = await repo.getLeadChain(lead.id);
    expect(chain).toMatchObject({
      leadId: lead.id,
      customerId: "cust-1",
      quoteId: "q-1",
      jobId: "j-1",
    });
  });

  it("reports source performance counts", async () => {
    const a = await repo.createLead(leadInput());
    await repo.setQualification(a.id, "qualified");
    await repo.createLead(leadInput({ attribution: { source: "referral" } }));
    const perf = await repo.getSourcePerformance();
    const website = perf.find((p) => p.source === "website");
    expect(website?.leads).toBe(1);
    expect(website?.qualified).toBe(1);
    expect(perf.find((p) => p.source === "referral")?.leads).toBe(1);
  });

  it("reports service performance counts", async () => {
    await repo.createLead(leadInput({ serviceRequested: "Brake repair" }));
    await repo.createLead(leadInput({ serviceRequested: "Brake repair" }));
    await repo.createLead(leadInput({ serviceRequested: "Oil change" }));
    const perf = await repo.getServicePerformance();
    expect(perf.find((p) => p.service === "Brake repair")?.leads).toBe(2);
  });

  it("returns no retention opportunities without a Jobs repository", async () => {
    expect(await repo.listRetentionOpportunities()).toEqual([]);
  });

  it("derives retention opportunities from the Jobs repository", async () => {
    const oldAt = Date.now() - 400 * DAY;
    registerRepository("jobs.repository", {
      listJobs: async () => [
        {
          id: "job-1",
          customerId: "cust-1",
          status: "completed",
          updatedAt: oldAt,
          createdAt: oldAt,
        },
      ],
    });
    const items = await repo.listRetentionOpportunities();
    expect(items[0]?.customerId).toBe("cust-1");
    expect(items[0]?.reasons.length).toBeGreaterThan(0);
  });
});

describe("marketing repository — opportunities and actions", () => {
  let repo: MarketingRepository;
  beforeEach(() => {
    repo = fresh();
  });

  const opp = () =>
    repo.createOpportunity({
      type: "search_query",
      title: "Rank for brake repair Denver",
      evidenceSource: "manual",
      evidence: "Johnny heard it from three customers this week.",
      confidence: 60,
    });

  it("creates an opportunity in identified status with its evidence source", async () => {
    const o = await opp();
    expect(o.status).toBe("identified");
    expect(o.evidenceSource).toBe("manual");
    expect(isUuidV4(o.id)).toBe(true);
  });

  it("rejects an opportunity with no evidence source", async () => {
    await expect(
      repo.createOpportunity({
        type: "search_query",
        title: "No evidence",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        evidenceSource: undefined as any,
      }),
    ).rejects.toThrow(/evidence/i);
  });

  it("moves identified → reviewing → approved", async () => {
    const o = await opp();
    const reviewed = await repo.reviewOpportunity(o.id);
    expect(reviewed.status).toBe("reviewing");
    const approved = await repo.approveOpportunity(o.id);
    expect(approved.status).toBe("approved");
    expect(approved.approvedAt).toBeTypeOf("number");
  });

  it("emits marketing.opportunity.approved on approval", async () => {
    const spy = vi.spyOn(emitter, "emit");
    const o = await opp();
    await repo.reviewOpportunity(o.id);
    await repo.approveOpportunity(o.id);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MARKETING_EVENTS.opportunityApproved,
      }),
    );
    spy.mockRestore();
  });

  it("dismisses an opportunity with a reason", async () => {
    const o = await opp();
    const d = await repo.dismissOpportunity(o.id, "not our market");
    expect(d.status).toBe("dismissed");
    expect(d.dismissReason).toBe("not our market");
  });

  it("creates an action in recommended status", async () => {
    const a = await repo.createAction({
      type: "service_page",
      title: "Write a brake repair page",
    });
    expect(a.status).toBe("recommended");
  });

  it("marks content-producing action types as public-facing", async () => {
    const a = await repo.createAction({
      type: "service_page",
      title: "Brake page",
    });
    expect(a.publicFacing).toBe(true);
    const b = await repo.createAction({
      type: "technical_fix",
      title: "Fix sitemap",
    });
    expect(b.publicFacing).toBe(false);
  });

  it("enforces the action lifecycle order", async () => {
    const a = await repo.createAction({
      type: "technical_fix",
      title: "Fix sitemap",
    });
    await expect(repo.markActionExecuted(a.id)).rejects.toThrow();
    await repo.reviewAction(a.id);
    await repo.approveAction(a.id, "johnny");
    const executed = await repo.markActionExecuted(a.id);
    expect(executed.status).toBe("executed");
    const measured = await repo.measureAction(a.id, "sitemap indexed");
    expect(measured.status).toBe("measured");
    expect(measured.outcome).toBe("sitemap indexed");
  });

  it("requires review before approval", async () => {
    const a = await repo.createAction({
      type: "technical_fix",
      title: "Fix sitemap",
    });
    await expect(repo.approveAction(a.id)).rejects.toThrow();
  });

  it("rejects an action with a reason", async () => {
    const a = await repo.createAction({
      type: "technical_fix",
      title: "Fix sitemap",
    });
    const r = await repo.rejectAction(a.id, "not worth it");
    expect(r.status).toBe("rejected");
    expect(r.rejectedReason).toBe("not worth it");
  });

  it("filters actions by status", async () => {
    const a = await repo.createAction({
      type: "technical_fix",
      title: "One",
    });
    await repo.createAction({ type: "technical_fix", title: "Two" });
    await repo.reviewAction(a.id);
    expect(await repo.listActions({ status: "reviewed" })).toHaveLength(1);
  });
});

describe("marketing repository — measured intelligence", () => {
  let repo: MarketingRepository;
  beforeEach(() => {
    repo = fresh();
  });

  it("records page performance with its evidence source", async () => {
    const rec = await repo.recordPagePerformance({
      page: "/services/brake-repair",
      periodStart: Date.now() - 30 * DAY,
      periodEnd: Date.now(),
      visits: 120,
      quoteRequests: 4,
      evidenceSource: "integration",
      integrationId: "int-1",
    });
    expect(rec.evidenceSource).toBe("integration");
    expect(await repo.listPagePerformance("/services/brake-repair")).toHaveLength(
      1,
    );
  });

  it("scores a recorded search opportunity with reasons", async () => {
    const rec = await repo.recordSearchOpportunity({
      query: "brake repair denver",
      impressions: 1000,
      clicks: 10,
      position: 12,
      periodStart: Date.now() - 30 * DAY,
      periodEnd: Date.now(),
      evidenceSource: "integration",
    });
    expect(rec.opportunityScore).toBeGreaterThan(0);
    expect(rec.scoreReasons.length).toBeGreaterThan(0);
    expect(rec.status).toBe("identified");
  });

  it("rejects a search record with no query", async () => {
    await expect(
      repo.recordSearchOpportunity({
        query: "  ",
        periodStart: 0,
        periodEnd: 1,
        evidenceSource: "manual",
      }),
    ).rejects.toThrow(/query/i);
  });

  it("records local visibility", async () => {
    await repo.recordLocalVisibility({
      profile: "primary",
      periodStart: Date.now() - 30 * DAY,
      periodEnd: Date.now(),
      views: 500,
      calls: 12,
      evidenceSource: "manual",
    });
    expect(await repo.listLocalVisibility()).toHaveLength(1);
  });

  it("notifies subscribers on change", async () => {
    const seen = vi.fn();
    const unsub = repo.subscribe(seen);
    await repo.createLead(leadInput());
    expect(seen).toHaveBeenCalled();
    unsub();
  });
});
