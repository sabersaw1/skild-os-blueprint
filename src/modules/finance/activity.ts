// Immutable activity event names for the Finance module.
// Rule: names are frozen once shipped. Add new events; never rename.
// See docs/activity-events.md.

export const FINANCE_EVENTS = {
  invoiceCreated: "finance.invoice.created",
  invoiceUpdated: "finance.invoice.updated",
  invoiceIssued: "finance.invoice.issued",
  invoiceVoided: "finance.invoice.voided",
  invoicePartiallyPaid: "finance.invoice.partially_paid",
  invoicePaid: "finance.invoice.paid",
  paymentRecorded: "finance.payment.recorded",
} as const;

export type FinanceEventType =
  (typeof FINANCE_EVENTS)[keyof typeof FINANCE_EVENTS];
