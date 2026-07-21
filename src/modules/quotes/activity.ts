// Immutable activity event names for the Quotes module.
// Rule: names are frozen once shipped. Add new events; never rename.
// See docs/activity-events.md.

export const QUOTE_EVENTS = {
  created: "quote.created",
  updated: "quote.updated",
  versionCreated: "quote.version.created",
  sent: "quote.sent",
  approved: "quote.approved",
  declined: "quote.declined",
  expired: "quote.expired",
} as const;

export type QuoteEventType = (typeof QUOTE_EVENTS)[keyof typeof QUOTE_EVENTS];
