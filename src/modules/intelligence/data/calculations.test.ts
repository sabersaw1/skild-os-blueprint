// Deterministic BI calculation tests (Phase 14).
//
// These assert the property that matters most for this module: a figure is
// either derived from real records or explicitly declared unavailable. No
// calculation is allowed to invent a value, and no comparison is allowed to
// invent a baseline.

import { describe, expect, it } from "vitest";
import {
  calculateComparison,
  calculateFunnel,
  calculateMetrics,
  calculateProfitability,
  calculateServicePerformance,
  calculateSourcePerformance,
  datasetHasRecords,
  emptyDataset,
  previousPeriod,
  type IntelligenceDataset,
} from "./calculations";
import type { Period } from "./schemas";

const DAY = 86_400_000;
const NOW = 1_700_000_000_000;
const PERIOD: Period = { start: NOW - 30 * DAY, end: NOW };

function ds(over: Partial<IntelligenceDataset> = {}): IntelligenceDataset {
  return { ...emptyDataset(PERIOD, NOW), ...over };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lead = (o: Record<string, unknown>): any => ({
  id: "l1",
  createdAt: NOW - DAY,
  status: "new",
  channel: "website_form",
  attribution: { source: "website" },
  serviceRequested: "Brakes",
  ...o,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const quote = (o: Record<string, unknown>): any => ({
  id: "q1",
  createdAt: NOW - DAY,
  status: "draft",
  totalCents: 100_00,
  ...o,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const job = (o: Record<string, unknown>): any => ({
  id: "j1",
  createdAt: NOW - DAY,
  status: "completed",
  title: "Brake job",
  ...o,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const invoice = (o: Record<string, unknown>): any => ({
  id: "i1",
  createdAt: NOW - DAY,
  issuedAt: NOW - DAY,
  status: "issued",
  totalCents: 200_00,
  balance: 0,
  number: "INV-1",
  ...o,
});

describe("dataset emptiness", () => {
  it("reports no records for an empty dataset", () => {
    expect(datasetHasRecords(ds())).toBe(false);
  });

  it("reports records once a lead falls inside the period", () => {
    expect(datasetHasRecords(ds({ leads: [lead({})] }))).toBe(true);
  });
});

describe("metrics", () => {
  it("marks every metric unavailable when there are no records at all", () => {
    const metrics = calculateMetrics(ds());
    expect(metrics.length).toBeGreaterThan(0);
    expect(metrics.every((m) => m.completeness !== "complete")).toBe(true);
  });

  it("never returns NaN or Infinity for a ratio metric with a zero denominator", () => {
    for (const m of calculateMetrics(ds())) {
      expect(Number.isFinite(m.value)).toBe(true);
    }
  });

  it("counts leads that fall inside the period only", () => {
    const dataset = ds({
      leads: [
        lead({ id: "in", createdAt: NOW - DAY }),
        lead({ id: "out", createdAt: NOW - 400 * DAY }),
      ],
    });
    const count = calculateMetrics(dataset, ["lead_count"])[0];
    expect(count?.value).toBe(1);
  });

  it("attaches evidence to every computed metric", () => {
    const dataset = ds({ leads: [lead({})] });
    for (const m of calculateMetrics(dataset)) {
      expect(Array.isArray(m.evidence)).toBe(true);
    }
  });
});

describe("profitability", () => {
  it("declares labor cost as a limitation rather than guessing it", () => {
    const report = calculateProfitability(ds({ invoices: [invoice({})] }));
    expect(report.limitations.join(" ")).toMatch(/labor/i);
  });

  it("computes gross margin from invoiced revenue minus recorded parts cost", () => {
    const report = calculateProfitability(
      ds({
        invoices: [invoice({ totalCents: 500_00 })],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        partsUsage: [{ id: "u1", jobId: "j1", partId: "p1", quantity: 1, unitCostCents: 100_00, usedAt: NOW - DAY } as any],
      }),
    );
    expect(report.revenueCents).toBe(500_00);
    expect(report.grossMarginCents).toBe(report.revenueCents - report.partsCostCents);
  });
});

describe("funnel", () => {
  it("returns zeroed stages and no conversion rates when nothing exists", () => {
    const funnel = calculateFunnel(ds());
    expect(funnel.stages.every((s) => s.count === 0)).toBe(true);
    expect(
      funnel.stages.every(
        (s) => s.conversionFromPrevious === null || s.conversionFromPrevious === 0,
      ),
    ).toBe(true);
  });

  it("derives conversion from stage counts, not from assumptions", () => {
    const funnel = calculateFunnel(
      ds({
        leads: [lead({ id: "a" }), lead({ id: "b" })],
        quotes: [quote({ id: "q1" })],
        jobs: [job({ id: "j1" })],
      }),
    );
    const leadStage = funnel.stages.find((s) => s.id === "lead");
    expect(leadStage?.count).toBe(2);
  });
});

describe("performance breakdowns", () => {
  it("returns no rows when no records exist", () => {
    expect(calculateServicePerformance(ds())).toEqual([]);
    expect(calculateSourcePerformance(ds())).toEqual([]);
  });

  it("groups leads by their recorded source verbatim", () => {
    const rows = calculateSourcePerformance(
      ds({
        leads: [
          lead({ id: "a", attribution: { source: "google" } }),
          lead({ id: "b", attribution: { source: "google" } }),
          lead({ id: "c", attribution: { source: "referral" } }),
        ],
      }),
    );
    const google = rows.find((r) => r.source === "google");
    expect(google?.leadCount).toBe(2);
    expect(rows).toHaveLength(2);
  });
});

describe("historical comparison", () => {
  it("computes the previous window as an equal-length span ending at the start", () => {
    const prev = previousPeriod(PERIOD);
    expect(prev.end).toBe(PERIOD.start);
    expect(prev.end - prev.start).toBe(PERIOD.end - PERIOD.start);
  });

  it("declares no baseline instead of comparing against zero", () => {
    const report = calculateComparison(ds({ leads: [lead({})] }), ds());
    expect(report.baselineAvailable).toBe(false);
    expect(report.rows.every((r) => r.previousValue === null)).toBe(true);
    expect(report.rows.every((r) => r.changeRatio === null)).toBe(true);
    expect(report.limitations.join(" ")).toMatch(/no historical baseline/i);
  });

  it("computes a real change ratio once a baseline exists", () => {
    const prevPeriod = previousPeriod(PERIOD);
    const previous: IntelligenceDataset = {
      ...emptyDataset(prevPeriod, NOW),
      leads: [lead({ id: "p1", createdAt: prevPeriod.start + DAY })],
    };
    const current = ds({ leads: [lead({ id: "c1" }), lead({ id: "c2" })] });
    const report = calculateComparison(current, previous, ["lead_count"]);
    const row = report.rows[0]!;
    expect(report.baselineAvailable).toBe(true);
    expect(row.currentValue).toBe(2);
    expect(row.previousValue).toBe(1);
    expect(row.changeRatio).toBe(1);
  });

  it("leaves changeRatio null when the baseline value is zero", () => {
    const prevPeriod = previousPeriod(PERIOD);
    const previous: IntelligenceDataset = {
      ...emptyDataset(prevPeriod, NOW),
      leads: [lead({ id: "p1", createdAt: prevPeriod.start + DAY })],
    };
    const current = ds({
      leads: [lead({ id: "c1" })],
      invoices: [invoice({})],
    });
    const report = calculateComparison(current, previous, ["invoiced_revenue"]);
    expect(report.rows[0]!.previousValue).toBe(0);
    expect(report.rows[0]!.changeRatio).toBeNull();
  });
});
