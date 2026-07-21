// Immutable activity event names for the Knowledge module.
// Rule: names are frozen once shipped. Add new events; never rename.
// See docs/activity-events.md.

export const KNOWLEDGE_EVENTS = {
  documentCreated: "knowledge.document.created",
  documentUpdated: "knowledge.document.updated",
  documentVersionCreated: "knowledge.document.version.created",
  documentArchived: "knowledge.document.archived",
  linkCreated: "knowledge.link.created",
  pricingRuleUpdated: "knowledge.pricing_rule.updated",
} as const;

export type KnowledgeEventType =
  (typeof KNOWLEDGE_EVENTS)[keyof typeof KNOWLEDGE_EVENTS];
