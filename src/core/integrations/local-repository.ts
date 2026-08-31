// Local implementation of IntegrationRepository.
//
// Repository implementations are the ONLY place allowed to touch storage,
// and they go through the core versioned-envelope helpers — never raw
// localStorage.
//
// Storage keys:
//   skildos.integrations.connections.v1
//   skildos.integrations.syncstates.v1
//   skildos.integrations.externalrefs.v1
//
// Mutation ordering rule: validate → persist → emit → return.
// No successful event is emitted before persistence succeeds.
//
// SECURITY: connection records carry only a CredentialRef handle. Secret
// material never reaches this file; `assertNoSecretMaterial` is a backstop.

import { newId } from "@/core/ids";
import { emit } from "@/core/activity/emitter";
import { createStore } from "@/core/store";
import {
  readEnvelope,
  registerVersionedKey,
  writeEnvelope,
} from "@/core/storage/envelope";
import { INTEGRATION_EVENTS, INTEGRATIONS_MODULE_ID } from "./activity";
import { assertTransition } from "./connection-state";
import { assertNoSecretMaterial } from "./credentials";
import { IntegrationError } from "./errors";
import type { IntegrationRepository } from "./repository";
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

const K_CONNECTIONS = "skildos.integrations.connections.v1";
const K_SYNC = "skildos.integrations.syncstates.v1";
const K_REFS = "skildos.integrations.externalrefs.v1";

registerVersionedKey<IntegrationConnection>({
  key: K_CONNECTIONS,
  currentVersion: 1,
  migrations: { 0: (records) => records as IntegrationConnection[] },
});
registerVersionedKey<IntegrationSyncState>({
  key: K_SYNC,
  currentVersion: 1,
  migrations: { 0: (records) => records as IntegrationSyncState[] },
});
registerVersionedKey<ExternalReference>({
  key: K_REFS,
  currentVersion: 1,
  migrations: { 0: (records) => records as ExternalReference[] },
});

function requireText(value: string | undefined, field: string): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    throw new IntegrationError(
      "invalid_request",
      `Integration: "${field}" is required.`,
    );
  }
  return trimmed;
}

export function createLocalIntegrationRepository(): IntegrationRepository {
  const revision = createStore(0);
  const bump = () => revision.set((n) => n + 1);

  const readConnections = () =>
    readEnvelope<IntegrationConnection>(K_CONNECTIONS);
  const writeConnections = (rows: IntegrationConnection[]) =>
    writeEnvelope(K_CONNECTIONS, rows);
  const readSync = () => readEnvelope<IntegrationSyncState>(K_SYNC);
  const writeSync = (rows: IntegrationSyncState[]) =>
    writeEnvelope(K_SYNC, rows);
  const readRefs = () => readEnvelope<ExternalReference>(K_REFS);
  const writeRefs = (rows: ExternalReference[]) => writeEnvelope(K_REFS, rows);

  async function requireConnection(id: string): Promise<IntegrationConnection> {
    const found = readConnections().find((c) => c.id === id);
    if (!found) {
      throw new IntegrationError(
        "invalid_request",
        `Integration connection "${id}" not found.`,
      );
    }
    return found;
  }

  return {
    // ---- Connections ----------------------------------------------------
    async listConnections() {
      return readConnections()
        .slice()
        .sort((a, b) => a.provider.localeCompare(b.provider));
    },

    async getConnection(id) {
      return readConnections().find((c) => c.id === id);
    },

    async createConnection(input: ConnectionCreateInput) {
      const provider = requireText(input.provider, "provider") as ProviderId;
      const accountLabel = requireText(input.accountLabel, "accountLabel");
      assertNoSecretMaterial(input, "createConnection");

      const now = Date.now();
      const connection: IntegrationConnection = {
        id: newId(),
        provider,
        accountLabel,
        status: "disconnected",
        scopes: input.scopes ?? [],
        adapterKind: input.adapterKind ?? "stub",
        createdAt: now,
        updatedAt: now,
      };

      writeConnections([...readConnections(), connection]);
      bump();
      emit({
        type: INTEGRATION_EVENTS.connectionCreated,
        moduleId: INTEGRATIONS_MODULE_ID,
        summary: `Created ${provider} connection (${connection.adapterKind})`,
        payload: {
          connectionId: connection.id,
          provider,
          adapterKind: connection.adapterKind,
        },
      });
      return connection;
    },

    async updateConnection(id, patch: ConnectionUpdateInput) {
      const existing = await requireConnection(id);
      assertNoSecretMaterial(patch, "updateConnection");

      const next: IntegrationConnection = {
        ...existing,
        accountLabel: patch.accountLabel
          ? requireText(patch.accountLabel, "accountLabel")
          : existing.accountLabel,
        scopes: patch.scopes ?? existing.scopes,
        updatedAt: Date.now(),
      };
      const changedFields = Object.keys(patch).filter(
        (k) => (patch as Record<string, unknown>)[k] !== undefined,
      );

      writeConnections(readConnections().map((c) => (c.id === id ? next : c)));
      bump();
      emit({
        type: INTEGRATION_EVENTS.connectionUpdated,
        moduleId: INTEGRATIONS_MODULE_ID,
        summary: `Updated ${next.provider} connection`,
        payload: { connectionId: id, provider: next.provider, changedFields },
      });
      return next;
    },

    async setConnectionStatus(id, status: ConnectionStatus, detail) {
      const existing = await requireConnection(id);
      assertTransition(existing.status, status);

      const now = Date.now();
      const next: IntegrationConnection = {
        ...existing,
        status,
        accountLabel: detail?.accountLabel ?? existing.accountLabel,
        scopes: detail?.scopes ?? existing.scopes,
        connectedAt: status === "connected" ? now : existing.connectedAt,
        lastErrorAt: detail?.error ? now : existing.lastErrorAt,
        lastErrorCode: detail?.error?.code ?? existing.lastErrorCode,
        lastErrorMessage: detail?.error?.message ?? existing.lastErrorMessage,
        updatedAt: now,
      };
      if (status === "connected") {
        next.lastErrorCode = undefined;
        next.lastErrorMessage = undefined;
      }
      if (status === "disconnected") {
        next.connectedAt = undefined;
      }
      assertNoSecretMaterial(next, "setConnectionStatus");

      writeConnections(readConnections().map((c) => (c.id === id ? next : c)));
      bump();

      const type =
        status === "connected"
          ? INTEGRATION_EVENTS.connectionConnected
          : status === "disconnected"
            ? INTEGRATION_EVENTS.connectionDisconnected
            : status === "revoked"
              ? INTEGRATION_EVENTS.connectionRevoked
              : status === "error" || status === "expired"
                ? INTEGRATION_EVENTS.connectionFailed
                : INTEGRATION_EVENTS.connectionUpdated;

      emit({
        type,
        moduleId: INTEGRATIONS_MODULE_ID,
        summary: `${next.provider} connection is now ${status}`,
        payload: {
          connectionId: id,
          provider: next.provider,
          status,
          adapterKind: next.adapterKind,
          errorCode: detail?.error?.code,
          errorMessage: detail?.error?.message,
          retryable: detail?.error?.retryable,
        },
      });
      return next;
    },

    async removeConnection(id) {
      const existing = await requireConnection(id);
      writeConnections(readConnections().filter((c) => c.id !== id));
      writeSync(readSync().filter((s) => s.integrationId !== id));
      bump();
      emit({
        type: INTEGRATION_EVENTS.connectionDisconnected,
        moduleId: INTEGRATIONS_MODULE_ID,
        summary: `Removed ${existing.provider} connection`,
        payload: { connectionId: id, provider: existing.provider },
      });
    },

    // ---- Sync state -----------------------------------------------------
    async listSyncStates(integrationId) {
      const rows = readSync();
      return integrationId
        ? rows.filter((s) => s.integrationId === integrationId)
        : rows;
    },

    async startSync(integrationId, resourceType, mode: SyncMode = "manual") {
      const connection = await requireConnection(integrationId);
      if (connection.status !== "connected") {
        throw new IntegrationError(
          "authentication_failed",
          `Cannot sync "${resourceType}": connection is ${connection.status}.`,
          { provider: connection.provider },
        );
      }
      const type = requireText(resourceType, "resourceType");
      const rows = readSync();
      const existing = rows.find(
        (s) => s.integrationId === integrationId && s.resourceType === type,
      );
      const now = Date.now();
      const next: IntegrationSyncState = existing
        ? { ...existing, mode, status: "running", lastStartedAt: now, updatedAt: now }
        : {
            id: newId(),
            integrationId,
            resourceType: type,
            mode,
            status: "running",
            lastStartedAt: now,
            createdAt: now,
            updatedAt: now,
          };

      writeSync(existing ? rows.map((s) => (s.id === next.id ? next : s)) : [...rows, next]);
      bump();
      emit({
        type: INTEGRATION_EVENTS.syncStarted,
        moduleId: INTEGRATIONS_MODULE_ID,
        summary: `Sync started: ${connection.provider} / ${type}`,
        payload: {
          connectionId: integrationId,
          provider: connection.provider,
          resourceType: type,
          mode,
          syncStateId: next.id,
        },
      });
      return next;
    },

    async completeSync(syncStateId, result) {
      const rows = readSync();
      const existing = rows.find((s) => s.id === syncStateId);
      if (!existing) {
        throw new IntegrationError(
          "invalid_request",
          `Sync state "${syncStateId}" not found.`,
        );
      }
      const now = Date.now();
      const next: IntegrationSyncState = {
        ...existing,
        status: "succeeded",
        cursor: result.cursor ?? existing.cursor,
        lastCompletedAt: now,
        lastSuccessfulAt: now,
        lastErrorCode: undefined,
        lastErrorMessage: undefined,
        lastErrorRetryable: undefined,
        updatedAt: now,
      };
      writeSync(rows.map((s) => (s.id === syncStateId ? next : s)));

      const connections = readConnections();
      writeConnections(
        connections.map((c) =>
          c.id === existing.integrationId
            ? { ...c, lastSuccessfulSyncAt: now, updatedAt: now }
            : c,
        ),
      );
      bump();
      emit({
        type: INTEGRATION_EVENTS.syncCompleted,
        moduleId: INTEGRATIONS_MODULE_ID,
        summary: `Sync completed: ${existing.resourceType}`,
        payload: {
          connectionId: existing.integrationId,
          syncStateId,
          resourceType: existing.resourceType,
          importedCount: result.importedCount ?? 0,
        },
      });
      return next;
    },

    async failSync(syncStateId, error) {
      const rows = readSync();
      const existing = rows.find((s) => s.id === syncStateId);
      if (!existing) {
        throw new IntegrationError(
          "invalid_request",
          `Sync state "${syncStateId}" not found.`,
        );
      }
      const now = Date.now();
      const next: IntegrationSyncState = {
        ...existing,
        status: "failed",
        lastCompletedAt: now,
        lastErrorCode: error.code,
        lastErrorMessage: error.message,
        lastErrorRetryable: error.retryable,
        updatedAt: now,
      };
      writeSync(rows.map((s) => (s.id === syncStateId ? next : s)));
      bump();
      emit({
        type: INTEGRATION_EVENTS.syncFailed,
        moduleId: INTEGRATIONS_MODULE_ID,
        summary: `Sync failed: ${existing.resourceType} (${error.code})`,
        payload: {
          connectionId: existing.integrationId,
          syncStateId,
          resourceType: existing.resourceType,
          ...error.toSafeJSON(),
        },
      });
      return next;
    },

    // ---- External references (idempotency) ------------------------------
    async findExternalReference(provider, resourceType, externalId) {
      return readRefs().find(
        (r) =>
          r.provider === provider &&
          r.resourceType === resourceType &&
          r.externalId === externalId,
      );
    },

    async recordExternalReference(input: ExternalReferenceInput) {
      const provider = requireText(input.provider, "provider") as ProviderId;
      const resourceType = requireText(input.resourceType, "resourceType");
      const externalId = requireText(input.externalId, "externalId");
      assertNoSecretMaterial(input, "recordExternalReference");

      const rows = readRefs();
      const now = Date.now();
      const existing = rows.find(
        (r) =>
          r.provider === provider &&
          r.resourceType === resourceType &&
          r.externalId === externalId,
      );

      if (existing) {
        const refreshed: ExternalReference = {
          ...existing,
          lastSeenAt: now,
          // An import may attach the internal record later, but an existing
          // link is never silently repointed.
          internalId: existing.internalId ?? input.internalId,
          internalType: existing.internalType ?? input.internalType,
        };
        writeRefs(rows.map((r) => (r.id === existing.id ? refreshed : r)));
        bump();
        return { reference: refreshed, created: false };
      }

      const reference: ExternalReference = {
        id: newId(),
        provider,
        externalId,
        resourceType,
        internalId: input.internalId,
        internalType: input.internalType,
        provenance: input.provenance ?? "external_source",
        firstSeenAt: now,
        lastSeenAt: now,
      };
      writeRefs([...rows, reference]);
      bump();
      emit({
        type: INTEGRATION_EVENTS.externalReferenceSeen,
        moduleId: INTEGRATIONS_MODULE_ID,
        summary: `New external record: ${provider} / ${resourceType}`,
        payload: {
          provider,
          resourceType,
          externalReferenceId: reference.id,
          provenance: reference.provenance,
        },
      });
      return { reference, created: true };
    },

    async listExternalReferences(provider) {
      const rows = readRefs();
      return provider ? rows.filter((r) => r.provider === provider) : rows;
    },

    subscribe(listener) {
      return revision.subscribe(listener);
    },
  };
}
