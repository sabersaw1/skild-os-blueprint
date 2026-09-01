// Business Intelligence repository tests (Phase 14).
//
// Focus: the human-control and evidence boundaries.
//  - a mutation without the capability never persists and never emits
//  - findings are deduplicated per rule + period, so re-running is safe
//  - snapshots are append-only history
//  - the module never invents a record when a source module is missing

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

import { createLocalIntelligenceRepository } from "./local-repository";
import { INTELLIGENCE_EVENTS } from "../activity";
import * as emitter from "@/core/activity/emitter";
import * as roles from "@/core/roles/roles";
import { clearRepository } from "@/core/data/registry";
import { isUuidV4 } from "@/core/ids";
import type { IntelligenceRepository } from "./repository";
import type { Evidence, Period } from "./schemas";

const DAY = 86_400_000;
const storage = () =>
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage;

function fresh(): IntelligenceRepository {
  storage().clear();
  clearRepository();
  return createLocalIntelligenceRepository();
}

function period(days = 30): Period {
  const end = Date.now();
  return { start: end - days * DAY, end };
}

const evidence: Evidence[] = [
  {
    kind: "record_count",
    statement: "3 quotes were sent and none were answered.",
    sources: [{ module: "quotes", entity: "quote", id: "q1" }],
  },
];

/** Deny exactly one capability, allow the rest (Owner holds "*"). */
function denyOnly(capabilityId: string) {
  const real = roles.hasCapability;
  vi.spyOn(roles, "hasCapability").mockImplementation((roleId, id) =>
    id === capabilityId ? false : real(roleId, id),
  );
}

let repo: IntelligenceRepository;

beforeEach(() => {
  vi.restoreAllMocks();
  repo = fresh();
});

describe("metric definitions", () => {
  it("exposes a frozen catalogue with stable ids and versions", async () => {
    const defs = await repo.listMetricDefinitions();
    expect(defs.length).toBeGreaterThan(0);
    for (const d of defs) {
      expect(typeof d.id).toBe("string");
      expect(d.version).toBeGreaterThanOrEqual(1);
    }
    const ids = defs.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("read models with no source modules registered", () => {
  it("returns an overview that declares unavailable modules rather than zeros presented as fact", async () => {
    const overview = await repo.getOverview(period());
    expect(overview.unavailableModules.length).toBeGreaterThan(0);
    expect(overview.metrics.length).toBeGreaterThan(0);
  });

  it("returns an empty attention list rather than invented items", async () => {
    expect(await repo.getAttention()).toEqual([]);
  });

  it("declares no baseline when no history exists", async () => {
    const report = await repo.getComparison(period());
    expect(report.baselineAvailable).toBe(false);
    expect(report.rows.every((r) => r.previousValue === null)).toBe(true);
  });

  it("rejects an unknown metric id instead of returning an empty result", async () => {
    await expect(repo.getComparison(period(), ["not_a_metric"])).rejects.toThrow(
      /unknown metric/i,
    );
  });
});

describe("snapshots", () => {
  it("persists one snapshot per metric with a uuid and generator", async () => {
    const snaps = await repo.calculateAndStoreSnapshots(period());
    expect(snaps.length).toBeGreaterThan(0);
    for (const s of snaps) {
      expect(isUuidV4(s.id)).toBe(true);
      expect(s.generatedBy).toBeTruthy();
    }
    expect((await repo.listSnapshots()).length).toBe(snaps.length);
  });

  it("appends rather than overwrites, so history stays truthful", async () => {
    const first = await repo.calculateAndStoreSnapshots(period(), ["lead_count"]);
    const second = await repo.calculateAndStoreSnapshots(period(), ["lead_count"]);
    const all = await repo.listSnapshots({ metricId: "lead_count" });
    expect(all).toHaveLength(2);
    expect(first[0]!.id).not.toBe(second[0]!.id);
  });

  it("requires intelligence.calculate and persists nothing when denied", async () => {
    denyOnly("intelligence.calculate");
    await expect(repo.calculateAndStoreSnapshots(period())).rejects.toThrow(
      /not authorized/i,
    );
    expect(await repo.listSnapshots()).toEqual([]);
  });
});

describe("observations", () => {
  it("records an observation with evidence and emits an immutable event", async () => {
    const spy = vi.spyOn(emitter, "emitActivity");
    const obs = await repo.createObservation({
      type: "conversion_drop",
      severity: "warning",
      title: "Quotes are not converting",
      description: "3 sent quotes have had no response.",
      evidence,
      confidence: 0.9,
    });
    expect(isUuidV4(obs.id)).toBe(true);
    expect(obs.status).toBe("open");
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ type: INTELLIGENCE_EVENTS.observationRecorded }),
    );
  });

  it("refuses an observation with no evidence", async () => {
    await expect(
      repo.createObservation({
        type: "conversion_drop",
        severity: "warning",
        title: "Gut feeling",
        description: "Feels slow.",
        evidence: [],
        confidence: 0.5,
      }),
    ).rejects.toThrow();
  });

  it("requires intelligence.recommend, emitting nothing when denied", async () => {
    denyOnly("intelligence.recommend");
    const spy = vi.spyOn(emitter, "emitActivity");
    await expect(
      repo.createObservation({
        type: "conversion_drop",
        severity: "info",
        title: "x",
        description: "y",
        evidence,
        confidence: 0.5,
      }),
    ).rejects.toThrow(/not authorized/i);
    expect(spy).not.toHaveBeenCalled();
    expect(await repo.listObservations()).toEqual([]);
  });

  it("records a human acknowledgement as a status change", async () => {
    const obs = await repo.createObservation({
      type: "conversion_drop",
      severity: "info",
      title: "x",
      description: "y",
      evidence,
      confidence: 0.5,
    });
    const acked = await repo.acknowledgeObservation(obs.id);
    expect(acked.status).toBe("acknowledged");
    expect(acked.id).toBe(obs.id);
  });

  it("requires intelligence.dismiss to reject a finding", async () => {
    const obs = await repo.createObservation({
      type: "conversion_drop",
      severity: "info",
      title: "x",
      description: "y",
      evidence,
      confidence: 0.5,
    });
    denyOnly("intelligence.dismiss");
    await expect(repo.dismissObservation(obs.id, "known")).rejects.toThrow(
      /not authorized/i,
    );
    expect((await repo.getObservation(obs.id))!.status).toBe("open");
  });
});

describe("recommendations", () => {
  it("accepting a recommendation performs no action — it only records the decision", async () => {
    const rec = await repo.createRecommendation({
      recommendationType: "follow_up",
      title: "Follow up on 3 quotes",
      reason: "They were sent over 7 days ago with no response.",
      evidence,
      confidence: 0.8,
      proposedAction: "Call each customer.",
      requiredCapabilities: ["communication.send"],
      approvalRequirement: "approval_required",
    });
    const accepted = await repo.acceptRecommendation(rec.id);
    expect(accepted.status).toBe("accepted");
    // Acceptance is a record, not an execution: nothing else changed.
    expect(await repo.listSnapshots()).toEqual([]);
  });

  it("never exposes an execute path", () => {
    expect((repo as unknown as Record<string, unknown>)["execute"]).toBeUndefined();
    expect(
      (repo as unknown as Record<string, unknown>)["executeRecommendation"],
    ).toBeUndefined();
  });
});

describe("optimization run", () => {
  it("produces no findings when there are no records to justify one", async () => {
    const result = await repo.runOptimization(period());
    expect(result.observations).toEqual([]);
    expect(result.opportunities).toEqual([]);
    expect(result.recommendations).toEqual([]);
  });

  it("is idempotent — re-running the same period does not duplicate findings", async () => {
    const p = period();
    await repo.runOptimization(p);
    const afterFirst = (await repo.listObservations()).length;
    await repo.runOptimization(p);
    expect((await repo.listObservations()).length).toBe(afterFirst);
  });

  it("requires intelligence.recommend", async () => {
    denyOnly("intelligence.recommend");
    await expect(repo.runOptimization(period())).rejects.toThrow(/not authorized/i);
  });
});

describe("subscriptions", () => {
  it("notifies subscribers after a persisted change", async () => {
    const listener = vi.fn();
    const unsub = repo.subscribe(listener);
    await repo.createObservation({
      type: "conversion_drop",
      severity: "info",
      title: "x",
      description: "y",
      evidence,
      confidence: 0.5,
    });
    expect(listener).toHaveBeenCalled();
    unsub();
  });
});
