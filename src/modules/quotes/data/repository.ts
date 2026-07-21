// Quotes repository — public interface only.
// The concrete local implementation lives in ./local-repository.ts and is
// registered at bootstrap under QUOTES_REPOSITORY. Consumers (route
// components, hooks, other modules) import ONLY from this file.

import type {
  Quote,
  QuoteCreateInput,
  QuoteListQuery,
  QuoteStatusInput,
  QuoteUpdateInput,
  QuoteVersion,
} from "./schemas";

export const QUOTES_REPOSITORY = "quotes.repository";

export interface QuotesRepository {
  // Quotes
  listQuotes(query?: QuoteListQuery): Promise<Quote[]>;
  getQuote(id: string): Promise<Quote | undefined>;
  createQuote(input: QuoteCreateInput): Promise<Quote>;
  /** Mutating edit — creates a new immutable version as a side effect. */
  updateQuote(id: string, patch: QuoteUpdateInput): Promise<Quote>;

  // Status transitions (each emits its own activity event).
  sendQuote(id: string, input?: QuoteStatusInput): Promise<Quote>;
  approveQuote(id: string, input?: QuoteStatusInput): Promise<Quote>;
  declineQuote(id: string, input?: QuoteStatusInput): Promise<Quote>;
  expireQuote(id: string, input?: QuoteStatusInput): Promise<Quote>;

  // Versions
  listVersions(quoteId: string): Promise<QuoteVersion[]>;
  getVersion(id: string): Promise<QuoteVersion | undefined>;

  /** Subscribe to any change; consumers use this to refresh. */
  subscribe(listener: () => void): () => void;
}
