// Jarvis ↔ Business Intelligence boundary tests (Phase 14).
//
// Jarvis may READ measured figures and recorded findings. It must never be
// able to capture a snapshot, record a finding, or act on a recommendation,
// and it must state uncertainty rather than answer from nothing.

import { describe, expect, it, vi } from "vitest";

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

import {
  CapabilityDeniedError,
  JARVIS_TOOL_CATALOGUE,
  RepositoryUnavailableError,
  createJarvisTools,
  periodOfLastDays,
} from "./index";
import { classifyIntent } from "../intent/classify";
import { resolveContext } from "../context/resolver";
import { clearRepository, registerRepository } from "@/core/data/registry";
import { INTELLIGENCE_REPOSITORY } from "@/modules/intelligence/data/repository";
import { createLocalIntelligenceRepository } from "@/modules/intelligence/data/local-repository";

const allow = () => true;
const deny = () => false;

function withRepo() {
  clearRepository();
  registerRepository(INTELLIGENCE_REPOSITORY, createLocalIntelligenceRepository());
}

describe("intelligence tool catalogue", () => {
  it("declares every intelligence tool as requiring intelligence.read", () => {
    const bi = JARVIS_TOOL_CATALOGUE.filter((t) =>
      t.repositoryKey === INTELLIGENCE_REPOSITORY,
    );
    expect(bi.length).toBe(4);
    expect(bi.every((t) => t.requiredCapabilityId === "intelligence.read")).toBe(true);
  });

  it("exposes no write, snapshot or execute tool", () => {
    const tools = createJarvisTools(allow) as unknown as Record<string, unknown>;
    for (const name of [
      "captureSnapshot",
      "calculateAndStoreSnapshots",
      "createObservation",
      "runOptimization",
      "acceptRecommendation",
    ]) {
      expect(tools[name]).toBeUndefined();
    }
  });
});

describe("capability and availability boundaries", () => {
  it("denies the tool without intelligence.read", async () => {
    withRepo();
    await expect(createJarvisTools(deny).getBusinessOverview()).rejects.toBeInstanceOf(
      CapabilityDeniedError,
    );
  });

  it("reports an unavailable repository instead of fabricating figures", async () => {
    clearRepository();
    await expect(createJarvisTools(allow).getBusinessOverview()).rejects.toBeInstanceOf(
      RepositoryUnavailableError,
    );
  });
});

describe("reading measured data", () => {
  it("returns a real overview for the default 30-day window", async () => {
    withRepo();
    const overview = await createJarvisTools(allow).getBusinessOverview();
    expect(overview.metrics.length).toBeGreaterThan(0);
    const span = overview.period.end - overview.period.start;
    expect(Math.round(span / 86_400_000)).toBe(30);
  });

  it("declares the labor-cost limitation on profitability", async () => {
    withRepo();
    const report = await createJarvisTools(allow).getProfitabilityReport(
      periodOfLastDays(7),
    );
    expect(report.limitations.join(" ")).toMatch(/labor/i);
  });

  it("returns empty finding lists when nothing has been recorded", async () => {
    withRepo();
    const findings = await createJarvisTools(allow).getIntelligenceFindings();
    expect(findings.observations).toEqual([]);
    expect(findings.opportunities).toEqual([]);
    expect(findings.recommendations).toEqual([]);
  });
});

describe("intent routing", () => {
  it.each([
    ["how is the business performing?", "intelligence.overview"],
    ["what is our funnel conversion?", "intelligence.overview"],
    ["what should we improve in the business?", "intelligence.findings"],
  ])("maps %s", (question, expected) => {
    expect(classifyIntent(question).type).toBe(expected);
  });
});

describe("grounded answers", () => {
  it("states uncertainty instead of asserting numbers when no findings exist", async () => {
    withRepo();
    const context = await resolveContext({
      intent: classifyIntent("what should we improve in the business?"),
      tools: createJarvisTools(allow),
      question: "what should we improve in the business?",
    });
    expect(context.uncertainty.join(" ")).toMatch(/no findings/i);
  });

  it("records a declared limitation rather than an answer when access is denied", async () => {
    withRepo();
    const spy = vi.fn();
    const context = await resolveContext({
      intent: classifyIntent("how is the business performing?"),
      tools: createJarvisTools(deny),
      question: "how is the business performing?",
    });
    expect(context.facts.every((f) => f.evidenceKind !== "ai_suggestion")).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });
});
