// Public entry point for the Quotes module.
// Consumers import types + the register function from here.

export { registerQuotesModule } from "./manifest";
export { QUOTES_CAPABILITIES } from "./capabilities";
export { QUOTE_EVENTS } from "./activity";
export {
  QUOTES_REPOSITORY,
  type QuotesRepository,
} from "./data/repository";
export {
  QUOTE_STATUSES,
  LINE_ITEM_CATEGORIES,
  type Quote,
  type QuoteCreateInput,
  type QuoteListQuery,
  type QuoteSnapshot,
  type QuoteStatus,
  type QuoteStatusChange,
  type QuoteStatusInput,
  type QuoteTotals,
  type QuoteUpdateInput,
  type QuoteVersion,
  type LineItem,
  type LineItemCategory,
  type LineItemInput,
} from "./data/schemas";
export { computeTotals, lineTotal } from "./data/totals";
export {
  useQuote,
  useQuotes,
  useQuotesRepository,
  useQuoteVersions,
} from "./hooks";
