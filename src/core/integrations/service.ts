// Integration service — the only orchestration seam between adapters and
// the connection repository.
//
// Rules enforced here:
//   * adapters never persist anything themselves;
//   * a failed adapter call always lands the connection in a visible
//     failure state (never silently healthy);
//   * every mutation goes validate → persist → emit → return via the
//     repository.

import { getRepository } from "@/core/data/registry";
import { getIntegrationAdapter } from "./registry";
import { INTEGRATIONS_REPOSITORY, type IntegrationRepository } from "./repository";
import { toIntegrationError, IntegrationError } from "./errors";
import type { IntegrationConnection } from "./types";

function repo(): IntegrationRepository {
  return getRepository<IntegrationRepository>(INTEGRATIONS_REPOSITORY);
}

export async function connectConnection(
  connectionId: string,
): Promise<IntegrationConnection> {
  const r = repo();
  const connection = await r.getConnection(connectionId);
  if (!connection) {
    throw new IntegrationError(
      "invalid_request",
      `Connection "${connectionId}" not found.`,
    );
  }
  const adapter = getIntegrationAdapter(connection.provider);

  const connecting = await r.setConnectionStatus(connectionId, "connecting");
  try {
    const result = await adapter.connect({ connection: connecting });
    return await r.setConnectionStatus(connectionId, result.status, {
      accountLabel: result.accountLabel,
      scopes: result.scopes,
    });
  } catch (err) {
    const error = toIntegrationError(err, "authentication_failed");
    return r.setConnectionStatus(connectionId, "error", { error });
  }
}

export async function disconnectConnection(
  connectionId: string,
): Promise<IntegrationConnection> {
  const r = repo();
  const connection = await r.getConnection(connectionId);
  if (!connection) {
    throw new IntegrationError(
      "invalid_request",
      `Connection "${connectionId}" not found.`,
    );
  }
  const adapter = getIntegrationAdapter(connection.provider);
  await adapter.disconnect({ connection });
  return r.setConnectionStatus(connectionId, "disconnected");
}

export async function testConnection(connectionId: string): Promise<{
  ok: boolean;
  detail: string;
}> {
  const r = repo();
  const connection = await r.getConnection(connectionId);
  if (!connection) {
    throw new IntegrationError(
      "invalid_request",
      `Connection "${connectionId}" not found.`,
    );
  }
  const adapter = getIntegrationAdapter(connection.provider);
  const result = await adapter.testConnection({ connection });
  if (!result.ok && result.error) {
    await r.setConnectionStatus(connectionId, "error", { error: result.error });
  }
  return { ok: result.ok, detail: result.detail };
}

/**
 * Run one synchronization pass. External records are recorded as external
 * references (idempotency) and returned to the caller — this function does
 * NOT create business records. Importers are a later phase and must write
 * through the owning module's repository.
 */
export async function runSync(
  connectionId: string,
  resourceType: string,
): Promise<{ seen: number; newRecords: number }> {
  const r = repo();
  const connection = await r.getConnection(connectionId);
  if (!connection) {
    throw new IntegrationError(
      "invalid_request",
      `Connection "${connectionId}" not found.`,
    );
  }
  const adapter = getIntegrationAdapter(connection.provider);
  if (!adapter.sync) {
    throw new IntegrationError(
      "unsupported_operation",
      `${adapter.displayName} does not support synchronization.`,
      { provider: connection.provider },
    );
  }

  const state = await r.startSync(connectionId, resourceType);
  try {
    const result = await adapter.sync({
      connection,
      resourceType,
      cursor: state.cursor,
    });
    let newRecords = 0;
    for (const record of result.records) {
      const { created } = await r.recordExternalReference({
        provider: connection.provider,
        externalId: record.externalId,
        resourceType: record.resourceType,
        provenance: "external_source",
      });
      if (created) newRecords += 1;
    }
    await r.completeSync(state.id, {
      cursor: result.cursor,
      importedCount: newRecords,
    });
    return { seen: result.records.length, newRecords };
  } catch (err) {
    const error = toIntegrationError(err, "sync_failed");
    await r.failSync(state.id, error);
    throw error;
  }
}
