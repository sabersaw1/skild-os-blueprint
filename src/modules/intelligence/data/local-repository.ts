// Local implementation of IntelligenceRepository (Phase 14).
//
// Storage keys (versioned envelopes — see ./storage.ts):
//   skildos.intelligence.snapshots.v1
//   skildos.intelligence.observations.v1
//   skildos.intelligence.opportunities.v1
//   skildos.intelligence.recommendations.v1
//
// BI stores ANALYTICAL records only. It never stores a customer, vehicle,
// quote, job, invoice, payment, part or lead — those live in their owning
// modules and are referenced by opaque id through SourceRef.
//
// Mutation ordering rule (Phase 12.2 / 13.5):
//   authorize → validate → persist → confirm → emit
// A validation or persistence failure leaves storage untouched and emits NO
// business event.
//
// EXECUTION BOUNDARY: nothing in this file changes a price, sends a message,
// publishes content, issues an invoice, moves money, alters a business rule
// or deletes a source record. Recommendations are proposals; execution is
// the Phase 13 automation boundary's job.

import { newId } from "@/core/ids";
import { getIdentity } from "@/core/auth/identity";
import { emit } from "@/core/activity/emitter";
import { withCapabilityEnforcement } from "@/core/auth/authorize";
import { commitRecords } from "@/core/storage/persistence";
import { INTELLIGENCE_EVENTS } from "../activity";
import { readEnvelope, registerVersionedKey } from "./storage";
import {
  calculateAttention,
  calculateExpectedVsActual,
  calculateFunnel,
  calculateMetrics,
  calculateProfitability,
  calculateServicePerformance,
  calculateSourcePerformance,
  findMetricCalculator,
  METRIC_DEFINITIONS,
} from "./calculations";
import { loadDataset } from "./read-models";
import { DEFAULT_THRESHOLDS, runOptimizationRules } from "./optimization";
import {
  EVIDENCE_KINDS,
  OBSERVATION_SEVERITIES,
  OBSERVATION_TYPES,
  OPPORTUNITY_TYPES,
  RECOMMENDATION_TYPES,
  type AttentionItem,
  type Evidence,
  type ExpectedVsActualRow,
  type FunnelReport,
  type IntelligenceOpportunity,
  type IntelligenceOverview,
  type MetricComputation,
  type MetricDefinition,
  type MetricSnapshot,
  type Observation,
  type ObservationCreateInput,
  type ObservationListQuery,
  type ObservationStatus,
  type OpportunityCreateInput,
  type OpportunityListQuery,
  type OpportunityStatus,
  type OptimizationResult,
  type OptimizationThresholds,
  type Period,
  type ProfitabilityReport,
  type Recommendation,
  type RecommendationCreateInput,
  type RecommendationListQuery,
  type RecommendationStatus,
  type ServicePerformanceRow,
  type SourcePerformanceRow,
} from "./schemas";
import type { IntelligenceRepository } from "./repository";

const K_SNAPSHOTS = "skildos.intelligence.snapshots.v1";
const K_OBSERVATIONS = "skildos.intelligence.observations.v1";
const K_OPPORTUNITIES = "skildos.intelligence.opportunities.v1";
const K_RECOMMENDATIONS = "skildos.intelligence.recommendations.v1";

registerVersionedKey<MetricSnapshot>({ key: K_SNAPSHOTS, currentVersion: 1, migrations: {} });
registerVersionedKey<Observation>({ key: K_OBSERVATIONS, currentVersion: 1, migrations: {} });
registerVersionedKey<IntelligenceOpportunity>({
  key: K_OPPORTUNITIES,
  currentVersion: 1,
  migrations: {},
});
registerVersionedKey<Recommendation>({
  key: K_RECOMMENDATIONS,
  currentVersion: 1,
  migrations: {},
});

/** Keep persisted analytical history bounded on a local device. */
const MAX_SNAPSHOTS = 2000;

// ---- Validation ---------------------------------------------------------

function assertPeriod(period: Period): void {
  if (
    !Number.isFinite(period?.start) ||
    !Number.isFinite(period?.end) ||
    period.end <= period.start
  ) {
    throw new Error("Period must have finite start < end (epoch ms).");
  }
}

function assertOneOf<T extends string>(value: T, allowed: readonly T[], label: string): void {
  if (!allowed.includes(value)) throw new Error(`Invalid ${label} "${value}".`);
}

function assertConfidence(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("Confidence must be a number between 0 and 1.");
  }
}

function trimmedRequired(value: string | undefined, label: string): string {
  const t = value?.trim();
  if (!t) throw new Error(`${label} is required.`);
  return t;
}

/**
 * Evidence is MANDATORY for every analytical claim, and each item declares
 * its kind. This is the rule that keeps an assumption from being promoted
 * into a verified business fact.
 */
function assertEvidence(evidence: Evidence[] | undefined, label: string): Evidence[] {
  if (!Array.isArray(evidence) || evidence.length === 0) {
    throw new Error(`${label} requires at least one evidence item.`);
  }
  return evidence.map((e) => {
    assertOneOf(e.kind, EVIDENCE_KINDS, "evidence kind");
    const statement = trimmedRequired(e.statement, "Evidence statement");
    const sources = Array.isArray(e.sources) ? e.sources : [];
    for (const s of sources) {
      if (!s?.module?.trim() || !s?.entity?.trim() || !s?.id?.trim()) {
        throw new Error("Evidence source must carry module, entity and id.");
      }
    }
    const out: Evidence = { kind: e.kind, statement, sources };
    if (e.value !== undefined) out.value = e.value;
    if (e.unit !== undefined) out.unit = e.unit;
    return out;
  });
}

// ---- Implementation -----------------------------------------------------

export function createLocalIntelligenceRepository(): IntelligenceRepository {
  let snapshots: MetricSnapshot[] = readEnvelope<MetricSnapshot>(K_SNAPSHOTS) ?? [];
  let observations: Observation[] = readEnvelope<Observation>(K_OBSERVATIONS) ?? [];
  let opportunities: IntelligenceOpportunity[] =
    readEnvelope<IntelligenceOpportunity>(K_OPPORTUNITIES) ?? [];
  let recommendations: Recommendation[] =
    readEnvelope<Recommendation>(K_RECOMMENDATIONS) ?? [];

  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  // In-memory state advances ONLY on a durable write; a failure throws
  // PersistenceError before any emit() runs.
  const persistSnapshots = (next: MetricSnapshot[]) => {
    snapshots = commitRecords(K_SNAPSHOTS, next.slice(0, MAX_SNAPSHOTS));
  };
  const persistObservations = (next: Observation[]) => {
    observations = commitRecords(K_OBSERVATIONS, next);
  };
  const persistOpportunities = (next: IntelligenceOpportunity[]) => {
    opportunities = commitRecords(K_OPPORTUNITIES, next);
  };
  const persistRecommendations = (next: Recommendation[]) => {
    recommendations = commitRecords(K_RECOMMENDATIONS, next);
  };

  const actor = () => getIdentity().id;

  const requireObservation = (id: string): Observation => {
    const found = observations.find((o) => o.id === id);
    if (!found) throw new Error(`Unknown observation "${id}".`);
    return found;
  };
  const requireOpportunity = (id: string): IntelligenceOpportunity => {
    const found = opportunities.find((o) => o.id === id);
    if (!found) throw new Error(`Unknown opportunity "${id}".`);
    return found;
  };
  const requireRecommendation = (id: string): Recommendation => {
    const found = recommendations.find((r) => r.id === id);
    if (!found) throw new Error(`Unknown recommendation "${id}".`);
    return found;
  };

  const thresholdsWith = (
    partial?: Partial<OptimizationThresholds>,
  ): OptimizationThresholds => ({ ...DEFAULT_THRESHOLDS, ...(partial ?? {}) });

  function createObservationRecord(input: ObservationCreateInput): Observation {
    assertOneOf(input.type, OBSERVATION_TYPES, "observation type");
    assertOneOf(input.severity, OBSERVATION_SEVERITIES, "observation severity");
    assertConfidence(input.confidence);
    const title = trimmedRequired(input.title, "Observation title");
    const description = trimmedRequired(input.description, "Observation description");
    const evidence = assertEvidence(input.evidence, "Observation");
    const now = Date.now();
    const record: Observation = {
      id: newId(),
      type: input.type,
      severity: input.severity,
      title,
      description,
      evidence,
      confidence: input.confidence,
      status: "open",
      createdAt: now,
      updatedAt: now,
      createdBy: actor(),
    };
    if (input.metricId) record.metricId = input.metricId;
    if (input.periodStart !== undefined) record.periodStart = input.periodStart;
    if (input.periodEnd !== undefined) record.periodEnd = input.periodEnd;
    if (input.dedupeKey) record.dedupeKey = input.dedupeKey;
    return record;
  }

  function createOpportunityRecord(input: OpportunityCreateInput): IntelligenceOpportunity {
    assertOneOf(input.type, OPPORTUNITY_TYPES, "opportunity type");
    assertConfidence(input.confidence);
    const title = trimmedRequired(input.title, "Opportunity title");
    const description = trimmedRequired(input.description, "Opportunity description");
    const evidence = assertEvidence(input.evidence, "Opportunity");
    if (input.expectedImpactCents !== undefined) {
      if (!Number.isSafeInteger(input.expectedImpactCents)) {
        throw new Error("expectedImpactCents must be an integer number of cents.");
      }
      if (!input.impactBasis?.trim()) {
        throw new Error("An expected impact requires impactBasis explaining how it was derived.");
      }
    }
    const now = Date.now();
    const record: IntelligenceOpportunity = {
      id: newId(),
      type: input.type,
      title,
      description,
      evidence,
      confidence: input.confidence,
      status: "open",
      relatedIds: input.relatedIds ?? [],
      createdAt: now,
      updatedAt: now,
      createdBy: actor(),
    };
    if (input.expectedImpactCents !== undefined) {
      record.expectedImpactCents = input.expectedImpactCents;
      record.impactBasis = input.impactBasis!.trim();
    }
    if (input.dedupeKey) record.dedupeKey = input.dedupeKey;
    return record;
  }

  function createRecommendationRecord(input: RecommendationCreateInput): Recommendation {
    assertOneOf(input.recommendationType, RECOMMENDATION_TYPES, "recommendation type");
    assertConfidence(input.confidence);
    const title = trimmedRequired(input.title, "Recommendation title");
    const reason = trimmedRequired(input.reason, "Recommendation reason");
    const proposedAction = trimmedRequired(input.proposedAction, "Proposed action");
    const evidence = assertEvidence(input.evidence, "Recommendation");
    if (!["human_review", "approval_required", "blocked"].includes(input.approvalRequirement)) {
      throw new Error(`Invalid approval requirement "${input.approvalRequirement}".`);
    }
    const now = Date.now();
    const record: Recommendation = {
      id: newId(),
      recommendationType: input.recommendationType,
      title,
      reason,
      evidence,
      confidence: input.confidence,
      proposedAction,
      requiredCapabilities: input.requiredCapabilities ?? [],
      approvalRequirement: input.approvalRequirement,
      status: "proposed",
      relatedIds: input.relatedIds ?? [],
      createdAt: now,
      updatedAt: now,
      createdBy: actor(),
    };
    if (input.dedupeKey) record.dedupeKey = input.dedupeKey;
    return record;
  }

  function transitionObservation(
    id: string,
    status: ObservationStatus,
    eventType: string,
    reason?: string,
  ): Observation {
    const existing = requireObservation(id);
    const next: Observation = { ...existing, status, updatedAt: Date.now() };
    persistObservations(observations.map((o) => (o.id === id ? next : o)));
    emit({
      type: eventType,
      moduleId: "intelligence",
      summary: `Observation ${status}`,
      payload: { id, type: next.type, ...(reason ? { reason } : {}) },
    });
    notify();
    return next;
  }

  const impl: IntelligenceRepository = {
    async listMetricDefinitions(): Promise<MetricDefinition[]> {
      return METRIC_DEFINITIONS.map((d) => ({ ...d }));
    },

    async getMetricDefinition(id: string) {
      const found = METRIC_DEFINITIONS.find((d) => d.id === id);
      return found ? { ...found } : undefined;
    },

    async computeMetrics(period: Period, metricIds?: string[]): Promise<MetricComputation[]> {
      assertPeriod(period);
      if (metricIds) {
        for (const id of metricIds) {
          if (!findMetricCalculator(id)) throw new Error(`Unknown metric "${id}".`);
        }
      }
      const ds = await loadDataset(period);
      return calculateMetrics(ds, metricIds);
    },

    async getOverview(period: Period, now = Date.now()): Promise<IntelligenceOverview> {
      assertPeriod(period);
      const ds = await loadDataset(period, now);
      const thresholds = thresholdsWith();
      return {
        period,
        generatedAt: now,
        metrics: calculateMetrics(ds),
        profitability: calculateProfitability(ds),
        funnel: calculateFunnel(ds),
        attention: calculateAttention(ds, thresholds).slice(0, 25),
        openObservationCount: observations.filter((o) => o.status === "open").length,
        openOpportunityCount: opportunities.filter((o) => o.status === "open").length,
        proposedRecommendationCount: recommendations.filter((r) => r.status === "proposed").length,
        unavailableModules: [...ds.unavailableModules],
      };
    },

    async getFunnel(period: Period): Promise<FunnelReport> {
      assertPeriod(period);
      return calculateFunnel(await loadDataset(period));
    },

    async getProfitability(period: Period): Promise<ProfitabilityReport> {
      assertPeriod(period);
      return calculateProfitability(await loadDataset(period));
    },

    async getServicePerformance(period: Period): Promise<ServicePerformanceRow[]> {
      assertPeriod(period);
      return calculateServicePerformance(await loadDataset(period));
    },

    async getSourcePerformance(period: Period): Promise<SourcePerformanceRow[]> {
      assertPeriod(period);
      return calculateSourcePerformance(await loadDataset(period));
    },

    async getExpectedVsActual(period: Period): Promise<ExpectedVsActualRow[]> {
      assertPeriod(period);
      return calculateExpectedVsActual(await loadDataset(period));
    },

    async getAttention(
      now = Date.now(),
      thresholds?: Partial<OptimizationThresholds>,
    ): Promise<AttentionItem[]> {
      const t = thresholdsWith(thresholds);
      // Attention is always "as of now" over all records, not a period slice.
      const ds = await loadDataset({ start: 0, end: now + 1 }, now);
      return calculateAttention(ds, t);
    },

    async calculateAndStoreSnapshots(
      period: Period,
      metricIds?: string[],
    ): Promise<MetricSnapshot[]> {
      assertPeriod(period);
      if (metricIds) {
        for (const id of metricIds) {
          if (!findMetricCalculator(id)) throw new Error(`Unknown metric "${id}".`);
        }
      }
      const ds = await loadDataset(period);
      const computations = calculateMetrics(ds, metricIds);
      const now = Date.now();
      const created: MetricSnapshot[] = computations.map((c) => {
        const evidence = [...c.evidence];
        if (c.limitation) {
          // A limitation is recorded as an ASSUMPTION-grade note so the figure
          // can never be read as an unqualified fact.
          evidence.push({ kind: "assumption", statement: c.limitation, sources: [] });
        }
        return {
          id: newId(),
          metricId: c.metricId,
          periodStart: period.start,
          periodEnd: period.end,
          value: c.value,
          unit: c.unit,
          calculationVersion: c.calculationVersion,
          completeness: c.completeness,
          evidence,
          generatedAt: now,
          generatedBy: actor(),
        };
      });

      persistSnapshots([...created, ...snapshots]);
      for (const snapshot of created) {
        emit({
          type: INTELLIGENCE_EVENTS.metricCalculated,
          moduleId: "intelligence",
          summary: `Metric ${snapshot.metricId} calculated`,
          payload: {
            id: snapshot.id,
            metricId: snapshot.metricId,
            value: snapshot.value,
            unit: snapshot.unit,
            completeness: snapshot.completeness,
            calculationVersion: snapshot.calculationVersion,
            periodStart: snapshot.periodStart,
            periodEnd: snapshot.periodEnd,
          },
        });
      }
      notify();
      return created;
    },

    async listSnapshots(query?: { metricId?: string; limit?: number }) {
      let out = [...snapshots];
      if (query?.metricId) out = out.filter((s) => s.metricId === query.metricId);
      out.sort((a, b) => b.generatedAt - a.generatedAt);
      return query?.limit ? out.slice(0, query.limit) : out;
    },

    async listObservations(query?: ObservationListQuery) {
      let out = [...observations];
      if (query?.status) out = out.filter((o) => o.status === query.status);
      if (query?.type) out = out.filter((o) => o.type === query.type);
      if (query?.severity) out = out.filter((o) => o.severity === query.severity);
      out.sort((a, b) => b.createdAt - a.createdAt);
      return query?.limit ? out.slice(0, query.limit) : out;
    },

    async getObservation(id: string) {
      return observations.find((o) => o.id === id);
    },

    async createObservation(input: ObservationCreateInput) {
      const record = createObservationRecord(input);
      persistObservations([record, ...observations]);
      emit({
        type: INTELLIGENCE_EVENTS.observationCreated,
        moduleId: "intelligence",
        summary: `Observation recorded: ${record.type}`,
        payload: {
          id: record.id,
          type: record.type,
          severity: record.severity,
          confidence: record.confidence,
          evidenceCount: record.evidence.length,
        },
      });
      notify();
      return record;
    },

    async acknowledgeObservation(id: string) {
      return transitionObservation(id, "acknowledged", INTELLIGENCE_EVENTS.observationAcknowledged);
    },

    async dismissObservation(id: string, reason?: string) {
      return transitionObservation(
        id,
        "dismissed",
        INTELLIGENCE_EVENTS.observationDismissed,
        reason?.trim(),
      );
    },

    async resolveObservation(id: string) {
      return transitionObservation(id, "resolved", INTELLIGENCE_EVENTS.observationResolved);
    },

    async listOpportunities(query?: OpportunityListQuery) {
      let out = [...opportunities];
      if (query?.status) out = out.filter((o) => o.status === query.status);
      if (query?.type) out = out.filter((o) => o.type === query.type);
      out.sort((a, b) => b.createdAt - a.createdAt);
      return query?.limit ? out.slice(0, query.limit) : out;
    },

    async getOpportunity(id: string) {
      return opportunities.find((o) => o.id === id);
    },

    async createOpportunity(input: OpportunityCreateInput) {
      const record = createOpportunityRecord(input);
      persistOpportunities([record, ...opportunities]);
      emit({
        type: INTELLIGENCE_EVENTS.opportunityCreated,
        moduleId: "intelligence",
        summary: `Opportunity identified: ${record.type}`,
        payload: {
          id: record.id,
          type: record.type,
          confidence: record.confidence,
          evidenceCount: record.evidence.length,
          ...(record.expectedImpactCents !== undefined
            ? { expectedImpactCents: record.expectedImpactCents }
            : {}),
        },
      });
      notify();
      return record;
    },

    async acknowledgeOpportunity(id: string) {
      return transitionOpportunity(id, "acknowledged", INTELLIGENCE_EVENTS.opportunityAcknowledged);
    },

    async dismissOpportunity(id: string, reason?: string) {
      return transitionOpportunity(
        id,
        "dismissed",
        INTELLIGENCE_EVENTS.opportunityDismissed,
        reason?.trim(),
      );
    },

    async listRecommendations(query?: RecommendationListQuery) {
      let out = [...recommendations];
      if (query?.status) out = out.filter((r) => r.status === query.status);
      if (query?.recommendationType) {
        out = out.filter((r) => r.recommendationType === query.recommendationType);
      }
      out.sort((a, b) => b.createdAt - a.createdAt);
      return query?.limit ? out.slice(0, query.limit) : out;
    },

    async getRecommendation(id: string) {
      return recommendations.find((r) => r.id === id);
    },

    async createRecommendation(input: RecommendationCreateInput) {
      const record = createRecommendationRecord(input);
      persistRecommendations([record, ...recommendations]);
      emit({
        type: INTELLIGENCE_EVENTS.recommendationCreated,
        moduleId: "intelligence",
        summary: `Recommendation proposed: ${record.recommendationType}`,
        payload: {
          id: record.id,
          recommendationType: record.recommendationType,
          approvalRequirement: record.approvalRequirement,
          requiredCapabilities: record.requiredCapabilities,
          confidence: record.confidence,
          evidenceCount: record.evidence.length,
        },
      });
      notify();
      return record;
    },

    async acceptRecommendation(id: string) {
      // Accepting records a HUMAN DECISION. It performs no action, sends
      // nothing, and changes no business rule.
      return transitionRecommendation(id, "accepted", INTELLIGENCE_EVENTS.recommendationAccepted);
    },

    async dismissRecommendation(id: string, reason?: string) {
      return transitionRecommendation(
        id,
        "dismissed",
        INTELLIGENCE_EVENTS.recommendationDismissed,
        reason?.trim(),
      );
    },

    async completeRecommendation(id: string) {
      return transitionRecommendation(id, "completed", INTELLIGENCE_EVENTS.recommendationCompleted);
    },

    async runOptimization(
      period: Period,
      opts?: { now?: number; thresholds?: Partial<OptimizationThresholds> },
    ): Promise<OptimizationResult> {
      assertPeriod(period);
      const now = opts?.now ?? Date.now();
      const ds = await loadDataset(period, now);
      const metrics = calculateMetrics(ds);
      const draft = runOptimizationRules(ds, metrics, thresholdsWith(opts?.thresholds));

      // Deduplicate against what is already stored: re-running the engine for
      // the same period must not create a second copy of the same finding.
      const newObservations = draft.observations
        .filter((o) => !o.dedupeKey || !observations.some((x) => x.dedupeKey === o.dedupeKey))
        .map(createObservationRecord);
      const newOpportunities = draft.opportunities
        .filter((o) => !o.dedupeKey || !opportunities.some((x) => x.dedupeKey === o.dedupeKey))
        .map(createOpportunityRecord);
      const newRecommendations = draft.recommendations
        .filter((r) => !r.dedupeKey || !recommendations.some((x) => x.dedupeKey === r.dedupeKey))
        .map(createRecommendationRecord);

      // Persist first; emit only after every write is confirmed.
      if (newObservations.length) persistObservations([...newObservations, ...observations]);
      if (newOpportunities.length) persistOpportunities([...newOpportunities, ...opportunities]);
      if (newRecommendations.length) {
        persistRecommendations([...newRecommendations, ...recommendations]);
      }

      for (const o of newObservations) {
        emit({
          type: INTELLIGENCE_EVENTS.observationCreated,
          moduleId: "intelligence",
          summary: `Observation recorded: ${o.type}`,
          payload: { id: o.id, type: o.type, severity: o.severity, rule: o.dedupeKey ?? null },
        });
      }
      for (const o of newOpportunities) {
        emit({
          type: INTELLIGENCE_EVENTS.opportunityCreated,
          moduleId: "intelligence",
          summary: `Opportunity identified: ${o.type}`,
          payload: { id: o.id, type: o.type, rule: o.dedupeKey ?? null },
        });
      }
      for (const r of newRecommendations) {
        emit({
          type: INTELLIGENCE_EVENTS.recommendationCreated,
          moduleId: "intelligence",
          summary: `Recommendation proposed: ${r.recommendationType}`,
          payload: {
            id: r.id,
            recommendationType: r.recommendationType,
            approvalRequirement: r.approvalRequirement,
            rule: r.dedupeKey ?? null,
          },
        });
      }

      emit({
        type: INTELLIGENCE_EVENTS.optimizationRun,
        moduleId: "intelligence",
        summary: "Optimization rules evaluated",
        payload: {
          periodStart: period.start,
          periodEnd: period.end,
          observations: newObservations.length,
          opportunities: newOpportunities.length,
          recommendations: newRecommendations.length,
          skipped: draft.skipped.length,
        },
      });

      if (newObservations.length || newOpportunities.length || newRecommendations.length) {
        notify();
      }

      return {
        observations: newObservations,
        opportunities: newOpportunities,
        recommendations: newRecommendations,
        skipped: draft.skipped,
      };
    },

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  // Authorization boundary — see src/core/auth/authorize.ts. Reads stay
  // ungated here (UI and Jarvis tools declare intelligence.read); every
  // mutation is capability-checked before validation, persistence or any
  // activity event.
  return withCapabilityEnforcement(impl, {
    calculateAndStoreSnapshots: "intelligence.calculate",
    createObservation: "intelligence.recommend",
    acknowledgeObservation: "intelligence.acknowledge",
    dismissObservation: "intelligence.dismiss",
    resolveObservation: "intelligence.acknowledge",
    createOpportunity: "intelligence.recommend",
    acknowledgeOpportunity: "intelligence.acknowledge",
    dismissOpportunity: "intelligence.dismiss",
    createRecommendation: "intelligence.recommend",
    acceptRecommendation: "intelligence.acknowledge",
    dismissRecommendation: "intelligence.dismiss",
    completeRecommendation: "intelligence.acknowledge",
    runOptimization: "intelligence.recommend",
  });

  // ---- Local helpers (closure over the collections) ---------------------

  function transitionOpportunity(
    id: string,
    status: OpportunityStatus,
    eventType: string,
    reason?: string,
  ): IntelligenceOpportunity {
    const existing = requireOpportunity(id);
    const next: IntelligenceOpportunity = { ...existing, status, updatedAt: Date.now() };
    persistOpportunities(opportunities.map((o) => (o.id === id ? next : o)));
    emit({
      type: eventType,
      moduleId: "intelligence",
      summary: `Opportunity ${status}`,
      payload: { id, type: next.type, ...(reason ? { reason } : {}) },
    });
    notify();
    return next;
  }

  function transitionRecommendation(
    id: string,
    status: RecommendationStatus,
    eventType: string,
    reason?: string,
  ): Recommendation {
    const existing = requireRecommendation(id);
    const next: Recommendation = { ...existing, status, updatedAt: Date.now() };
    persistRecommendations(recommendations.map((r) => (r.id === id ? next : r)));
    emit({
      type: eventType,
      moduleId: "intelligence",
      summary: `Recommendation ${status}`,
      payload: {
        id,
        recommendationType: next.recommendationType,
        ...(reason ? { reason } : {}),
      },
    });
    notify();
    return next;
  }
}
