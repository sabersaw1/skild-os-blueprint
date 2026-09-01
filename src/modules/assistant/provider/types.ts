// Model provider abstraction (Phase 12).
//
// The rest of Skild OS must never learn which model answers a question.
// No vendor name, SDK, endpoint, or credential may appear in a domain
// module — only this interface.
//
// SECURITY BOUNDARY: a provider implementation receives GROUNDED CONTEXT
// ONLY. It never receives credentials, and it is never handed a repository
// or storage handle. A future hosted provider must run server-side and read
// its key from the server environment; nothing here may read a key from
// the browser, localStorage, or the DOM.

import type { Fact, IntentType, KnowledgeCitation, Recommendation } from "../data/schemas";

export interface ModelRequest {
  question: string;
  intent: IntentType;
  /** Everything the provider is allowed to reason over. Nothing else. */
  facts: Fact[];
  recommendations: Recommendation[];
  knowledge: KnowledgeCitation[];
  /** Known gaps. A provider MUST NOT resolve these by inventing content. */
  uncertainty: string[];
}

export interface ModelResponse {
  /** Grounded prose summary. Must not introduce new claims. */
  summary: string;
  /** Extra uncertainty the provider wants to declare. */
  uncertainty?: string[];
}

export interface ModelProvider {
  /** Stable id recorded on every answer and proposal, e.g. "deterministic". */
  readonly id: string;
  /** Human label for the settings/debug surface. */
  readonly label: string;
  /** True when the provider calls out to a network service. */
  readonly remote: boolean;
  complete(request: ModelRequest): Promise<ModelResponse>;
}
