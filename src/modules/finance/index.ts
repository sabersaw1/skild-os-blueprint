// Finance / Invoicing module — public surface.
// Other modules and the shell import ONLY from this file.

export { registerFinanceModule } from "./manifest";
export { FINANCE_REPOSITORY, type FinanceRepository } from "./data/repository";
export { FINANCE_EVENTS, type FinanceEventType } from "./activity";
export { FINANCE_CAPABILITIES } from "./capabilities";
export { computeInvoiceTotals, nextInvoiceNumber } from "./data/totals";
export type * from "./data/schemas";
