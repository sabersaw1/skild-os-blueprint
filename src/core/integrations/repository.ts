// Integration repository — public interface only.
// The concrete local implementation lives in ./local-repository.ts and is
// registered at bootstrap under INTEGRATIONS_REPOSITORY.

import type { IntegrationError } from "./errors";
import type {
  ConnectionCreateInput,
  ConnectionStatus,
  ConnectionUpdateInput,
  ExternalReference,
  ExternalReferenceInput,
  IntegrationConnection,
  IntegrationSyncState,
  ProviderId,
  SyncMode,
} from "./types";

export const INTEGRATIONS_REPOSITORY = "integrations.repository";

export interface IntegrationRepository {
  // Connections
  listConnections(): Promise<IntegrationConnection[]>;
  getConnection(id: string): Promise<IntegrationConnection | undefined>;
  createConnection(
    input: ConnectionCreateInput,
  ): Promise<IntegrationConnection>;
  updateConnection(
    id: string,
    patch: ConnectionUpdateInput,
  ): Promise<IntegrationConnection>;
  setConnectionStatus(
    id: string,
    status: ConnectionStatus,
    detail?: { error?: IntegrationError; accountLabel?: string; scopes?: string[] },
  ): Promise<IntegrationConnection>;
  removeConnection(id: string): Promise<void>;

  // Sync state
  listSyncStates(integrationId?: string): Promise<IntegrationSyncState[]>;
  startSync(
    integrationId: string,
    resourceType: string,
    mode?: SyncMode,
  ): Promise<IntegrationSyncState>;
  completeSync(
    syncStateId: string,
    result: { cursor?: string; importedCount?: number },
  ): Promise<IntegrationSyncState>;
  failSync(
    syncStateId: string,
    error: IntegrationError,
  ): Promise<IntegrationSyncState>;

  // External identity / idempotency
  findExternalReference(
    provider: ProviderId,
    resourceType: string,
    externalId: string,
  ): Promise<ExternalReference | undefined>;
  /**
   * Idempotent: recording the same (provider, resourceType, externalId)
   * twice returns the existing reference with `lastSeenAt` refreshed —
   * it never creates a second record.
   */
  recordExternalReference(
    input: ExternalReferenceInput,
  ): Promise<{ reference: ExternalReference; created: boolean }>;
  listExternalReferences(
    provider?: ProviderId,
  ): Promise<ExternalReference[]>;

  subscribe(listener: () => void): () => void;
}
