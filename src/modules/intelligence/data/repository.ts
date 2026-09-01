// Business Intelligence repository — public interface only.
//
// The concrete local implementation lives in ./local-repository.ts and is
// registered at bootstrap under INTELLIGENCE_REPOSITORY. Consumers (route
// components, hooks, Jarvis tools, future automation) import ONLY from this
// file, so the implementation can later become server-backed, warehouse-
// backed, or worker-computed without touching a single consumer.

import type {
  AttentionItem,
  ExpectedVsActualRow,
  FunnelReport,
  IntelligenceOpportunity,
  IntelligenceOverview,
  MetricComputation,
  MetricDefinition,
  MetricSnapshot,
  Observation,
  ObservationCreateInput,
  ObservationListQuery,
  OpportunityCreateInput,
  OpportunityListQuery,
  OptimizationResult,
  OptimizationThresholds,
  Period,
  ProfitabilityReport,
  Recommendation,
  RecommendationCreateInput,
  RecommendationListQuery,
  ServicePerformanceRow,
  SourcePerformanceRow,
} from "./schemas";

export const INTELLIGENCE_REPOSITORY = "intelligence.repository";

export interface IntelligenceRepository {
  // ---- Metric definitions (frozen catalogue, never AI-authored) ---------
  listMetricDefinitions(): Promise<MetricDefinition[]>;
  getMetricDefinition(id: string): Promise<MetricDefinition | undefined>;

  // ---- Derived read models (computed on demand; nothing persisted) -----
  /** Deterministic computation over current records. Does NOT persist. */
  computeMetrics(period: Period, metricIds?: string[]): Promise<MetricComputation[]>;
  getOverview(period: Period, now?: number): Promise<IntelligenceOverview>;
  getFunnel(period: Period): Promise<FunnelReport>;
  getProfitability(period: Period): Promise<ProfitabilityReport>;
  getServicePerformance(period: Period): Promise<ServicePerformanceRow[]>;
  getSourcePerformance(period: Period): Promise<SourcePerformanceRow[]>;
  getExpectedVsActual(period: Period): Promise<ExpectedVsActualRow[]>;
  getAttention(now?: number, thresholds?: Partial<OptimizationThresholds>): Promise<AttentionItem[]>;

  // ---- Metric snapshots (durable measurement history) -------------------
  /** Requires intelligence.calculate. Persists a snapshot per metric. */
  calculateAndStoreSnapshots(period: Period, metricIds?: string[]): Promise<MetricSnapshot[]>;
  listSnapshots(query?: { metricId?: string; limit?: number }): Promise<MetricSnapshot[]>;

  // ---- Observations -----------------------------------------------------
  listObservations(query?: ObservationListQuery): Promise<Observation[]>;
  getObservation(id: string): Promise<Observation | undefined>;
  /** Requires intelligence.recommend. Evidence is mandatory. */
  createObservation(input: ObservationCreateInput): Promise<Observation>;
  acknowledgeObservation(id: string): Promise<Observation>;
  dismissObservation(id: string, reason?: string): Promise<Observation>;
  resolveObservation(id: string): Promise<Observation>;

  // ---- Opportunities ----------------------------------------------------
  listOpportunities(query?: OpportunityListQuery): Promise<IntelligenceOpportunity[]>;
  getOpportunity(id: string): Promise<IntelligenceOpportunity | undefined>;
  createOpportunity(input: OpportunityCreateInput): Promise<IntelligenceOpportunity>;
  acknowledgeOpportunity(id: string): Promise<IntelligenceOpportunity>;
  dismissOpportunity(id: string, reason?: string): Promise<IntelligenceOpportunity>;

  // ---- Recommendations (proposals only — never executed here) ----------
  listRecommendations(query?: RecommendationListQuery): Promise<Recommendation[]>;
  getRecommendation(id: string): Promise<Recommendation | undefined>;
  createRecommendation(input: RecommendationCreateInput): Promise<Recommendation>;
  /**
   * Marks a proposal as accepted by a human. Performs NO action: execution
   * remains the Phase 13 automation boundary's responsibility.
   */
  acceptRecommendation(id: string): Promise<Recommendation>;
  dismissRecommendation(id: string, reason?: string): Promise<Recommendation>;
  completeRecommendation(id: string): Promise<Recommendation>;

  // ---- Optimization engine ---------------------------------------------
  /**
   * Runs the deterministic rule set and persists any findings, deduplicated
   * by rule + period. Requires intelligence.recommend. Executes nothing.
   */
  runOptimization(
    period: Period,
    opts?: { now?: number; thresholds?: Partial<OptimizationThresholds> },
  ): Promise<OptimizationResult>;

  /** Subscribe to any change; consumers use this to refresh. */
  subscribe(listener: () => void): () => void;
}
