// Deterministic optimization rules (Phase 14).
//
// A rule is a pure function: dataset + metrics + thresholds → draft
// observations / opportunities / recommendations. No LLM, no randomness, no
// clock of its own.
//
// HARD BOUNDARY: nothing here changes a price, sends a message, publishes
// content, issues an invoice, moves money, alters a business rule, or
// deletes a record. Every output is a PROPOSAL carrying its evidence, and
// every recommendation declares the capabilities and approval requirement a
// future execution would need — which is the Phase 13 automation boundary's
// job, not this module's.

import {
  DAY_MS,
  calculateAttention,
  inPeriod,
  type IntelligenceDataset,
} from "./calculations";
import type {
  Evidence,
  MetricComputation,
  ObservationCreateInput,
  OpportunityCreateInput,
  OptimizationThresholds,
  RecommendationCreateInput,
  SourceRef,
} from "./schemas";

export const DEFAULT_THRESHOLDS: OptimizationThresholds = {
  staleLeadMs: 3 * DAY_MS,
  quoteAgingMs: 7 * DAY_MS,
  followUpBacklogCount: 5,
  responseTargetMs: 4 * 60 * 60 * 1000, // 4 hours
  partsCostIncreaseRatio: 0.2,
  serviceDemandChangeRatio: 0.5,
};

export interface OptimizationDraft {
  observations: ObservationCreateInput[];
  opportunities: OpportunityCreateInput[];
  recommendations: RecommendationCreateInput[];
  skipped: Array<{ rule: string; reason: string }>;
}

function periodKey(ds: IntelligenceDataset): string {
  return `${ds.period.start}-${ds.period.end}`;
}

function derived(statement: string, sources: SourceRef[], value?: number): Evidence {
  const e: Evidence = { kind: "system_derived", statement, sources };
  if (value !== undefined) e.value = value;
  return e;
}

function metricValue(metrics: MetricComputation[], id: string): MetricComputation | undefined {
  return metrics.find((m) => m.metricId === id);
}

/**
 * Run every rule. Rules that find no evidence produce NOTHING and record why
 * in `skipped` — an empty result is a valid, honest outcome.
 */
export function runOptimizationRules(
  ds: IntelligenceDataset,
  metrics: MetricComputation[],
  thresholds: OptimizationThresholds = DEFAULT_THRESHOLDS,
): OptimizationDraft {
  const draft: OptimizationDraft = {
    observations: [],
    opportunities: [],
    recommendations: [],
    skipped: [],
  };
  const key = periodKey(ds);
  const attention = calculateAttention(ds, {
    staleLeadMs: thresholds.staleLeadMs,
    quoteAgingMs: thresholds.quoteAgingMs,
  });

  // ---- Rule: follow-up backlog ------------------------------------------
  const staleLeads = attention.filter((a) => a.kind === "stale_lead");
  if (staleLeads.length >= thresholds.followUpBacklogCount) {
    const sources = staleLeads.map((a) => a.source);
    const evidence = [
      derived(
        `${staleLeads.length} lead(s) are waiting on Skild with no activity for at least ${Math.round(thresholds.staleLeadMs / DAY_MS)} day(s).`,
        sources.slice(0, 25),
        staleLeads.length,
      ),
    ];
    draft.observations.push({
      type: "follow_up_backlog",
      severity: staleLeads.length >= thresholds.followUpBacklogCount * 2 ? "high" : "medium",
      title: `${staleLeads.length} leads awaiting follow-up`,
      description:
        "Leads whose next action belongs to Skild have gone quiet past the follow-up threshold.",
      evidence,
      confidence: 1,
      periodStart: ds.period.start,
      periodEnd: ds.period.end,
      dedupeKey: `follow_up_backlog:${key}`,
    });
    draft.opportunities.push({
      type: "follow_up",
      title: "Work the stale lead backlog",
      description: `${staleLeads.length} lead(s) have had no Skild activity past the threshold.`,
      evidence,
      confidence: 0.9,
      relatedIds: sources.slice(0, 50),
      dedupeKey: `follow_up_backlog:${key}`,
    });
    draft.recommendations.push({
      recommendationType: "follow_up_leads",
      title: "Follow up with stale leads",
      reason: `${staleLeads.length} lead(s) are awaiting a Skild response beyond the ${Math.round(thresholds.staleLeadMs / DAY_MS)}-day threshold.`,
      evidence,
      confidence: 0.9,
      proposedAction:
        "Review each stale lead and send a follow-up, or mark it lost with a reason.",
      requiredCapabilities: ["leads.write", "communication.approve"],
      approvalRequirement: "approval_required",
      relatedIds: sources.slice(0, 50),
      dedupeKey: `follow_up_backlog:${key}`,
    });
  } else {
    draft.skipped.push({
      rule: "follow_up_backlog",
      reason: `${staleLeads.length} stale lead(s) is below the threshold of ${thresholds.followUpBacklogCount}.`,
    });
  }

  // ---- Rule: quote aging -------------------------------------------------
  const staleQuotes = attention.filter((a) => a.kind === "stale_quote");
  if (staleQuotes.length > 0) {
    const evidence = [
      derived(
        `${staleQuotes.length} sent quote(s) have had no decision for at least ${Math.round(thresholds.quoteAgingMs / DAY_MS)} day(s).`,
        staleQuotes.map((a) => a.source).slice(0, 25),
        staleQuotes.length,
      ),
    ];
    const pendingValue = staleQuotes.reduce((s, a) => s + (a.amountCents ?? 0), 0);
    draft.observations.push({
      type: "quote_aging",
      severity: "medium",
      title: `${staleQuotes.length} quotes awaiting a decision`,
      description: "Sent quotes have aged past the decision threshold.",
      evidence,
      confidence: 1,
      periodStart: ds.period.start,
      periodEnd: ds.period.end,
      dedupeKey: `quote_aging:${key}`,
    });
    draft.opportunities.push({
      type: "lead_conversion",
      title: "Chase aging quotes",
      description: `${staleQuotes.length} quote(s) are still open with no recorded decision.`,
      evidence,
      // Expected impact is the sum of the actual quoted totals — a verified
      // figure, not a forecast. It is the amount at stake, not a prediction
      // of what will close.
      expectedImpactCents: pendingValue,
      impactBasis:
        "Sum of the totals of the aging quotes. This is the value at stake, not a forecast of revenue.",
      evidenceless: undefined,
      confidence: 0.8,
      relatedIds: staleQuotes.map((a) => a.source).slice(0, 50),
      dedupeKey: `quote_aging:${key}`,
    } as OpportunityCreateInput);
    draft.recommendations.push({
      recommendationType: "review_quote_aging",
      title: "Review aging quotes",
      reason: `${staleQuotes.length} sent quote(s) have no recorded approval or decline.`,
      evidence,
      confidence: 0.8,
      proposedAction: "Contact each customer for a decision, or expire the quote.",
      requiredCapabilities: ["quotes.write", "communication.approve"],
      approvalRequirement: "approval_required",
      relatedIds: staleQuotes.map((a) => a.source).slice(0, 50),
      dedupeKey: `quote_aging:${key}`,
    });
  } else {
    draft.skipped.push({ rule: "quote_aging", reason: "No sent quotes are past the aging threshold." });
  }

  // ---- Rule: response time ----------------------------------------------
  const response = metricValue(metrics, "average_response_time");
  if (response && response.completeness !== "unavailable" && response.value > thresholds.responseTargetMs) {
    const hours = Math.round((response.value / (60 * 60 * 1000)) * 10) / 10;
    const targetHours = Math.round(thresholds.responseTargetMs / (60 * 60 * 1000));
    const evidence: Evidence[] = [
      ...response.evidence,
      derived(
        `Average first response was ${hours}h against a ${targetHours}h target.`,
        [],
        response.value,
      ),
    ];
    draft.observations.push({
      type: "response_time",
      severity: response.value > thresholds.responseTargetMs * 2 ? "high" : "medium",
      title: `First-response time is ${hours}h`,
      description: `Average first response exceeded the ${targetHours}h operational target.`,
      evidence,
      confidence: response.completeness === "complete" ? 1 : 0.7,
      metricId: response.metricId,
      periodStart: ds.period.start,
      periodEnd: ds.period.end,
      dedupeKey: `response_time:${key}`,
    });
    draft.recommendations.push({
      recommendationType: "improve_response_time",
      title: "Improve first-response time",
      reason: `Average first response of ${hours}h exceeds the ${targetHours}h target.`,
      evidence,
      confidence: 0.7,
      proposedAction:
        "Review how inbound leads are triaged and who is responsible for the first reply.",
      requiredCapabilities: ["leads.write"],
      approvalRequirement: "human_review",
      dedupeKey: `response_time:${key}`,
    });
  } else {
    draft.skipped.push({
      rule: "response_time",
      reason: response?.completeness === "unavailable"
        ? "No leads have a recorded first response."
        : "Average first-response time is within target.",
    });
  }

  // ---- Rule: quote conversion -------------------------------------------
  const conversion = metricValue(metrics, "quote_conversion_rate");
  const quoteCount = metricValue(metrics, "quote_count")?.value ?? 0;
  // A conversion rate over a handful of quotes is noise, not a finding.
  if (conversion && conversion.completeness !== "unavailable" && quoteCount >= 5 && conversion.value < 0.3) {
    const pct = Math.round(conversion.value * 100);
    const evidence: Evidence[] = [
      ...conversion.evidence,
      derived(`Quote conversion was ${pct}% across ${quoteCount} quote(s).`, [], conversion.value),
    ];
    draft.observations.push({
      type: "quote_conversion",
      severity: "medium",
      title: `Quote conversion is ${pct}%`,
      description: `Only ${pct}% of the ${quoteCount} quotes created in this period were approved.`,
      evidence,
      confidence: 0.8,
      metricId: conversion.metricId,
      periodStart: ds.period.start,
      periodEnd: ds.period.end,
      dedupeKey: `quote_conversion:${key}`,
    });
    draft.recommendations.push({
      recommendationType: "review_service_conversion",
      title: "Review low-converting quotes",
      reason: `${pct}% conversion across ${quoteCount} quotes is below the 30% review line.`,
      evidence,
      confidence: 0.7,
      proposedAction:
        "Review declined and expired quotes for pricing, scope, or follow-up gaps.",
      requiredCapabilities: ["quotes.read"],
      approvalRequirement: "human_review",
      dedupeKey: `quote_conversion:${key}`,
    });
  } else {
    draft.skipped.push({
      rule: "quote_conversion",
      reason: quoteCount < 5
        ? `Only ${quoteCount} quote(s) in period — too few to draw a conclusion.`
        : "Quote conversion is at or above the review line.",
    });
  }

  // ---- Rule: parts cost anomaly -----------------------------------------
  // Compares average unit cost per part in the period against the same part's
  // average unit cost BEFORE the period. Both figures come from recorded
  // usage; no benchmark is invented.
  const anomalies: Array<{ partId: string; before: number; now: number; refs: SourceRef[] }> = [];
  const byPart = new Map<string, { before: number[]; now: number[]; refs: SourceRef[] }>();
  for (const usage of ds.partsUsage) {
    if (usage.quantity <= 0) continue;
    const bucket = byPart.get(usage.partId) ?? { before: [], now: [], refs: [] };
    const unit = Math.round(usage.totalCost / usage.quantity);
    if (inPeriod(usage.usedAt, ds.period)) {
      bucket.now.push(unit);
      bucket.refs.push({ module: "parts", entity: "usage", id: usage.id });
    } else if (usage.usedAt < ds.period.start) {
      bucket.before.push(unit);
    }
    byPart.set(usage.partId, bucket);
  }
  for (const [partId, bucket] of byPart) {
    if (bucket.before.length === 0 || bucket.now.length === 0) continue;
    const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
    const before = avg(bucket.before);
    const now = avg(bucket.now);
    if (before <= 0) continue;
    if ((now - before) / before >= thresholds.partsCostIncreaseRatio) {
      anomalies.push({ partId, before, now, refs: bucket.refs });
    }
  }
  if (anomalies.length > 0) {
    for (const a of anomalies) {
      const pct = Math.round(((a.now - a.before) / a.before) * 100);
      const evidence = [
        derived(
          `Average unit cost rose from ${a.before}c to ${a.now}c (${pct}%) for this part.`,
          [{ module: "parts", entity: "part", id: a.partId }, ...a.refs.slice(0, 10)],
          a.now - a.before,
        ),
      ];
      draft.observations.push({
        type: "cost_anomaly",
        severity: pct >= 50 ? "high" : "medium",
        title: `Parts cost up ${pct}%`,
        description: "Recorded unit cost for a part increased against its own prior average.",
        evidence,
        confidence: a.refs.length >= 3 ? 0.8 : 0.5,
        periodStart: ds.period.start,
        periodEnd: ds.period.end,
        dedupeKey: `cost_anomaly:${a.partId}:${key}`,
      });
      draft.recommendations.push({
        recommendationType: "investigate_parts_cost",
        title: "Investigate a parts cost increase",
        reason: `Unit cost rose ${pct}% versus this part's own prior recorded average.`,
        evidence,
        confidence: 0.6,
        proposedAction: "Check supplier pricing and whether quoted part prices still hold.",
        requiredCapabilities: ["parts.read"],
        approvalRequirement: "human_review",
        relatedIds: [{ module: "parts", entity: "part", id: a.partId }],
        dedupeKey: `cost_anomaly:${a.partId}:${key}`,
      });
    }
  } else {
    draft.skipped.push({
      rule: "parts_cost_anomaly",
      reason: "No part has both prior and in-period usage exceeding the increase threshold.",
    });
  }

  // ---- Rule: service demand change --------------------------------------
  const priorStart = ds.period.start - (ds.period.end - ds.period.start);
  const countByService = (from: number, to: number) => {
    const counts = new Map<string, number>();
    for (const lead of ds.leads) {
      if (lead.createdAt < from || lead.createdAt >= to) continue;
      const service = (lead.serviceRequested ?? "unknown").trim() || "unknown";
      counts.set(service, (counts.get(service) ?? 0) + 1);
    }
    return counts;
  };
  const nowCounts = countByService(ds.period.start, ds.period.end);
  const priorCounts = countByService(priorStart, ds.period.start);
  let demandFindings = 0;
  for (const [service, count] of nowCounts) {
    if (service === "unknown") continue;
    const prior = priorCounts.get(service) ?? 0;
    if (prior < 2 || count < 2) continue;
    const change = (count - prior) / prior;
    if (change < thresholds.serviceDemandChangeRatio) continue;
    demandFindings += 1;
    const pct = Math.round(change * 100);
    const refs = ds.leads
      .filter(
        (l) =>
          inPeriod(l.createdAt, ds.period) &&
          ((l.serviceRequested ?? "unknown").trim() || "unknown") === service,
      )
      .map((l) => ({ module: "marketing", entity: "lead", id: l.id }));
    const evidence = [
      derived(
        `"${service}" leads went from ${prior} in the prior period to ${count} in this period (+${pct}%).`,
        refs.slice(0, 25),
        count - prior,
      ),
    ];
    draft.observations.push({
      type: "service_demand",
      severity: "info",
      title: `Demand for "${service}" is up ${pct}%`,
      description: "Lead volume for this service increased against the immediately prior period.",
      evidence,
      confidence: count >= 5 ? 0.8 : 0.5,
      periodStart: ds.period.start,
      periodEnd: ds.period.end,
      dedupeKey: `service_demand:${service}:${key}`,
    });
    draft.opportunities.push({
      type: "service_page",
      title: `Service demand opportunity: ${service}`,
      description: `Lead volume for "${service}" grew ${pct}% against the prior period.`,
      evidence,
      confidence: 0.6,
      relatedIds: refs.slice(0, 25),
      dedupeKey: `service_demand:${service}:${key}`,
    });
  }
  if (demandFindings === 0) {
    draft.skipped.push({
      rule: "service_demand",
      reason: "No service has enough leads in both periods to show a significant change.",
    });
  }

  // ---- Rule: outstanding revenue ----------------------------------------
  const unpaid = attention.filter((a) => a.kind === "outstanding_invoice");
  if (unpaid.length > 0) {
    const total = unpaid.reduce((s, a) => s + (a.amountCents ?? 0), 0);
    const evidence = [
      derived(
        `${unpaid.length} issued invoice(s) carry a combined balance of ${total}c.`,
        unpaid.map((a) => a.source).slice(0, 25),
        total,
      ),
    ];
    draft.recommendations.push({
      recommendationType: "chase_outstanding_invoices",
      title: "Chase outstanding invoices",
      reason: `${unpaid.length} invoice(s) remain unpaid.`,
      evidence,
      confidence: 1,
      proposedAction: "Review unpaid invoices and contact the customers.",
      requiredCapabilities: ["finance.read", "communication.approve"],
      approvalRequirement: "approval_required",
      relatedIds: unpaid.map((a) => a.source).slice(0, 50),
      dedupeKey: `outstanding_invoices:${key}`,
    });
  } else {
    draft.skipped.push({ rule: "outstanding_invoices", reason: "No issued invoice carries a balance." });
  }

  return draft;
}
