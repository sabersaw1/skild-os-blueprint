// Immutable activity event names for the Business Intelligence module.
// Rule: names are frozen once shipped. Add new events; never rename.
// See docs/activity-events.md.
//
// Payload rule: identifiers, enums, counts, metric values and safe reasons
// ONLY. Never customer contact details, message bodies, or credentials.

export const INTELLIGENCE_EVENTS = {
  metricCalculated: "intelligence.metric.calculated",

  observationCreated: "intelligence.observation.created",
  observationAcknowledged: "intelligence.observation.acknowledged",
  observationDismissed: "intelligence.observation.dismissed",
  observationResolved: "intelligence.observation.resolved",

  opportunityCreated: "intelligence.opportunity.created",
  opportunityAcknowledged: "intelligence.opportunity.acknowledged",
  opportunityDismissed: "intelligence.opportunity.dismissed",

  recommendationCreated: "intelligence.recommendation.created",
  recommendationAccepted: "intelligence.recommendation.accepted",
  recommendationDismissed: "intelligence.recommendation.dismissed",
  recommendationCompleted: "intelligence.recommendation.completed",

  optimizationRun: "intelligence.optimization.run",
} as const;

export type IntelligenceEventType =
  (typeof INTELLIGENCE_EVENTS)[keyof typeof INTELLIGENCE_EVENTS];
