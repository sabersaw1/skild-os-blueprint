// Versioned key/value helper used by repository implementations.
// Only repository *implementations* may import this file — components,
// hooks, and route files must never touch storage directly.
//
// Storage keys MUST include a schema version suffix (e.g. `.v1`). When a
// repository changes its stored shape it registers a migration and bumps
// the suffix so old data is either migrated or safely ignored.
//
// Phase 13.5: this module no longer speaks to `window.localStorage`. It
// speaks to the installed `StorageDriver` (see ./driver.ts), so the same
// contract holds in a browser tab, in a test worker, and — later — in a
// server/background host. The contract itself is unchanged:
//
//   readJson  → `fallback` when missing, unavailable, or corrupt
//   writeJson → TRUE only when the value was durably written
//
// A `false` return is the caller's signal that the mutation did NOT persist;
// repositories must treat it as a failure and emit no successful business
// event (see `@/core/storage/persistence`). `system.storage.writeFailed` is
// emitted so the failure is visible to an operator.

import { emit } from "@/core/activity/emitter";
import { getStorageDriver } from "./driver";

export function readJson<T>(key: string, fallback: T): T {
  const driver = getStorageDriver();
  if (!driver.available()) return fallback;
  try {
    const raw = driver.read(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Persist `value` under `key`. Returns TRUE only when the value was durably
 * written by the installed driver.
 */
export function writeJson(key: string, value: unknown): boolean {
  const driver = getStorageDriver();
  let ok = false;
  let message = `Storage driver "${driver.id}" is not available.`;
  if (driver.available()) {
    try {
      ok = driver.write(key, JSON.stringify(value));
      if (!ok) message = `Storage driver "${driver.id}" refused the write.`;
    } catch (err) {
      ok = false;
      message = err instanceof Error ? err.message : String(err);
    }
  }
  if (!ok) {
    emit({
      // Frozen event name (kept from Phase 1 for the activity contract).
      type: "system.storage.quotaExceeded",
      moduleId: "system",
      summary: `Storage write failed for ${key}`,
      payload: { key, driverId: driver.id, message },
    });
  }
  return ok;
}

export function removeKey(key: string): void {
  const driver = getStorageDriver();
  if (!driver.available()) return;
  try {
    driver.remove(key);
  } catch {
    /* ignore */
  }
}
