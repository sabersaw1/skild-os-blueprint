// Immutable activity event names for the Marketing + Lead Machine module.
// Rule: names are frozen once shipped. Add new events; never rename.
// See docs/activity-events.md.
//
// Payload rule: identifiers, enums, counts, and safe reasons ONLY.
// Never customer contact details, message bodies, or credentials.

export const MARKETING_EVENTS = {
  leadCreated: "marketing.lead.created",
  leadUpdated: "marketing.lead.updated",
  leadStatusChanged: "marketing.lead.status.changed",
  leadContacted: "marketing.lead.contacted",
  leadQualified: "marketing.lead.qualified",
  leadConverted: "marketing.lead.converted",
  leadLost: "marketing.lead.lost",
  leadLinked: "marketing.lead.linked",
  leadFollowUpScheduled: "marketing.lead.follow_up.scheduled",
  leadAttributionUpdated: "marketing.lead.attribution.updated",

  opportunityCreated: "marketing.opportunity.created",
  opportunityUpdated: "marketing.opportunity.updated",
  opportunityReviewed: "marketing.opportunity.reviewed",
  opportunityApproved: "marketing.opportunity.approved",
  opportunityDismissed: "marketing.opportunity.dismissed",

  actionCreated: "marketing.action.created",
  actionReviewed: "marketing.action.reviewed",
  actionApproved: "marketing.action.approved",
  actionExecuted: "marketing.action.executed",
  actionMeasured: "marketing.action.measured",
  actionRejected: "marketing.action.rejected",

  pagePerformanceRecorded: "marketing.page_performance.recorded",
  searchOpportunityRecorded: "marketing.search_opportunity.recorded",
  localVisibilityRecorded: "marketing.local_visibility.recorded",
} as const;

export type MarketingEventType =
  (typeof MARKETING_EVENTS)[keyof typeof MARKETING_EVENTS];
