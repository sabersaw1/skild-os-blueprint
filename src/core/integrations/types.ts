// Integration layer — provider-agnostic types.
//
// The core OS owns its business records. External providers are sources and
// destinations only. Nothing in this file may reference a vendor SDK, a
// vendor-specific field, or a secret value.
//
// See docs/integration-architecture.md.

/**
 * Provider ids are namespaced strings (`vendor` or `vendor.service`).
 * Extensible on purpose: adding a provider must not require editing core.
 */
export type ProviderId = string;

export const KNOWN_PROVIDERS = [
  "google.gmail",
  "google.calendar",
  "google.business",
  "ebay",
  "amazon",
  "autozone",
  "advance_auto",
  "oreilly",
  "website",
  "payment_provider",
] as const;

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error"
  | "revoked"
  | "expired";

/** A connection is only usable for provider calls in this state. */
export const HEALTHY_STATUSES: ConnectionStatus[] = ["connected"];

/**
 * Adapter kind. `stub` adapters never talk to a real provider and MUST be
 * surfaced as such in the UI — a stub must never be presented as a real
 * external connection.
 */
export type AdapterKind = "stub" | "live";

/**
 * Opaque pointer to credential material held by a secret backend.
 * The core never sees, stores, or logs the secret itself.
 */
export interface CredentialRef {
  /** Backend that can resolve this reference (e.g. "none", "server-vault"). */
  backend: string;
  /** Opaque handle. MUST NOT be a token, key, password, or secret. */
  handle: string;
}

export interface IntegrationConnection {
  id: string;
  provider: ProviderId;
  /** Human label, e.g. an account email. Never a secret. */
  accountLabel: string;
  status: ConnectionStatus;
  scopes: string[];
  /** Marks a non-real connection created by a stub adapter. */
  adapterKind: AdapterKind;
  credentialRef?: CredentialRef;
  connectedAt?: number;
  lastSuccessfulSyncAt?: number;
  lastErrorAt?: number;
  /** Safe, displayable error summary. Never contains provider secrets. */
  lastErrorCode?: string;
  lastErrorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ConnectionCreateInput {
  provider: ProviderId;
  accountLabel: string;
  scopes?: string[];
  adapterKind?: AdapterKind;
}

export interface ConnectionUpdateInput {
  accountLabel?: string;
  scopes?: string[];
}

// ---- Sync ----------------------------------------------------------------

export type SyncStatus = "idle" | "running" | "succeeded" | "failed";

/** How a given resource is synchronized. Not every provider supports all. */
export type SyncMode = "full" | "incremental" | "webhook" | "poll" | "manual";

export interface IntegrationSyncState {
  id: string;
  integrationId: string;
  /** Provider-agnostic resource name, e.g. "messages", "orders", "events". */
  resourceType: string;
  mode: SyncMode;
  /** Opaque provider checkpoint. Optional — not all providers have cursors. */
  cursor?: string;
  status: SyncStatus;
  lastStartedAt?: number;
  lastCompletedAt?: number;
  lastSuccessfulAt?: number;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  /** True when the last failure may be retried. */
  lastErrorRetryable?: boolean;
  createdAt: number;
  updatedAt: number;
}

// ---- External identity / idempotency -------------------------------------

/**
 * Provenance of a record's data. External data is never automatically
 * treated as verified internal truth.
 */
export type Provenance =
  | "internal_verified"
  | "external_source"
  | "customer_provided"
  | "ai_suggested"
  | "assumption";

/**
 * Maps a provider's record identity to an internal record so the same
 * external event is never imported twice.
 */
export interface ExternalReference {
  id: string;
  provider: ProviderId;
  /** Provider-side stable id (message id, order id, event id). */
  externalId: string;
  /** Provider-agnostic resource name. */
  resourceType: string;
  /** Internal record id, once an import has produced one. */
  internalId?: string;
  /** Which internal repository the internal id belongs to. */
  internalType?: string;
  provenance: Provenance;
  firstSeenAt: number;
  lastSeenAt: number;
}

export interface ExternalReferenceInput {
  provider: ProviderId;
  externalId: string;
  resourceType: string;
  internalId?: string;
  internalType?: string;
  provenance?: Provenance;
}
