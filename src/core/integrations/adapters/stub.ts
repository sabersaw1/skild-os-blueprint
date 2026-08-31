// Stub adapters.
//
// A stub adapter NEVER contacts a real provider and never holds credentials.
// It exists so the integration architecture is exercised end-to-end and so
// the UI can be smoke-tested. Every stub reports `kind: "stub"` and the UI
// labels it as such — a stub connection must never be presented as a real
// external connection.

import { IntegrationError } from "../errors";
import type {
  AdapterCapabilities,
  IntegrationAdapter,
  SyncResult,
} from "../adapter";
import type { ProviderId } from "../types";

export function createStubAdapter(config: {
  providerId: ProviderId;
  displayName: string;
  capabilities?: Partial<AdapterCapabilities>;
  /** Records the stub returns from sync(). Deterministic, non-secret. */
  sampleRecords?: SyncResult["records"];
}): IntegrationAdapter {
  const capabilities: AdapterCapabilities = {
    syncModes: ["manual"],
    readResources: [],
    writeResources: [],
    requiresUserInteraction: false,
    ...config.capabilities,
  };

  return {
    providerId: config.providerId,
    displayName: config.displayName,
    kind: "stub",
    capabilities,

    async connect() {
      return {
        status: "connected" as const,
        accountLabel: `stub:${config.providerId}`,
        scopes: [],
      };
    },

    async disconnect() {
      /* nothing external to revoke */
    },

    async getStatus({ connection }) {
      return connection.status;
    },

    async testConnection() {
      return {
        ok: true,
        detail:
          "Stub adapter responded locally. This is NOT a real provider connection.",
      };
    },

    async sync({ resourceType }) {
      if (!capabilities.readResources.includes(resourceType)) {
        throw new IntegrationError(
          "unsupported_operation",
          `Stub adapter for ${config.providerId} cannot read "${resourceType}".`,
          { provider: config.providerId },
        );
      }
      return {
        resourceType,
        cursor: `stub-cursor-${Date.now()}`,
        records: config.sampleRecords ?? [],
      };
    },
  };
}

/**
 * Adapter for a provider whose live integration is deferred. It refuses to
 * connect rather than faking success, so a deferred provider can never
 * appear healthy.
 */
export function createDeferredAdapter(config: {
  providerId: ProviderId;
  displayName: string;
  reason: string;
  capabilities?: Partial<AdapterCapabilities>;
}): IntegrationAdapter {
  const fail = () =>
    new IntegrationError("configuration_missing", config.reason, {
      provider: config.providerId,
    });

  return {
    providerId: config.providerId,
    displayName: config.displayName,
    kind: "stub",
    capabilities: {
      syncModes: [],
      readResources: [],
      writeResources: [],
      requiresUserInteraction: true,
      ...config.capabilities,
    },
    async connect() {
      throw fail();
    },
    async disconnect() {
      /* nothing was ever connected */
    },
    async getStatus({ connection }) {
      return connection.status;
    },
    async testConnection() {
      const error = fail();
      return { ok: false, detail: error.message, error };
    },
  };
}
