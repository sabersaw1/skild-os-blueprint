// Provider adapter contract.
//
// Everything vendor-specific lives behind this interface. Core business
// modules (CRM, Vehicles, Knowledge, Inspections, Quotes, Jobs, Parts,
// Finance) MUST NOT import provider SDKs or OAuth implementations — they
// resolve an adapter from the Integration Registry instead.
//
// Adapters MUST NOT write to storage, to localStorage, or to business
// repositories directly. They normalize provider data and hand it to the
// import boundary, which writes through the existing repositories.

import type { IntegrationError } from "./errors";
import type {
  AdapterKind,
  ConnectionStatus,
  IntegrationConnection,
  ProviderId,
  SyncMode,
} from "./types";

export interface AdapterCapabilities {
  /** Sync modes the provider actually supports. */
  syncModes: SyncMode[];
  /** Provider-agnostic resource names this adapter can read. */
  readResources: string[];
  /** Resources this adapter can write back to the provider. */
  writeResources: string[];
  /** True when connecting requires an interactive user authorization step. */
  requiresUserInteraction: boolean;
}

export interface ConnectResult {
  status: ConnectionStatus;
  accountLabel: string;
  scopes: string[];
  /** Present only when a secure credential backend stored material. */
  credentialRefHandle?: string;
  credentialBackend?: string;
}

export interface TestConnectionResult {
  ok: boolean;
  /** Safe, displayable detail. Never provider secrets. */
  detail: string;
  error?: IntegrationError;
}

export interface SyncResult {
  resourceType: string;
  /** Opaque provider checkpoint, when the provider supports one. */
  cursor?: string;
  /** Normalized, provider-agnostic records awaiting the import boundary. */
  records: NormalizedExternalRecord[];
}

/**
 * What an adapter returns from a sync. Deliberately not a business entity:
 * external data is not verified business truth until an importer validates
 * it and writes through the owning repository.
 */
export interface NormalizedExternalRecord {
  externalId: string;
  resourceType: string;
  occurredAt?: number;
  /** Safe summary for operator display. */
  summary: string;
  /** Provider payload, already stripped of credentials by the adapter. */
  data: Record<string, unknown>;
}

export interface IntegrationAdapter {
  readonly providerId: ProviderId;
  readonly displayName: string;
  readonly kind: AdapterKind;
  readonly capabilities: AdapterCapabilities;

  connect(input: {
    connection: IntegrationConnection;
  }): Promise<ConnectResult>;

  disconnect(input: { connection: IntegrationConnection }): Promise<void>;

  getStatus(input: {
    connection: IntegrationConnection;
  }): Promise<ConnectionStatus>;

  testConnection(input: {
    connection: IntegrationConnection;
  }): Promise<TestConnectionResult>;

  /** Optional — only adapters that can read provider data implement it. */
  sync?(input: {
    connection: IntegrationConnection;
    resourceType: string;
    cursor?: string;
  }): Promise<SyncResult>;
}
