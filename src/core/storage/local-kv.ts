// Versioned localStorage helper used by repository implementations.
// Only repository *implementations* may import this file — components,
// hooks, and route files must never touch localStorage directly.
//
// Storage keys MUST include a schema version suffix (e.g. `.v1`). When a
// repository changes its stored shape it registers a migration and bumps
// the suffix so old data is either migrated or safely ignored.
//
// Reads gracefully return `fallback` when:
//   * `window` is undefined (SSR / tests without a DOM)
//   * the key is missing
//   * JSON parsing fails (corrupted store)
//
// Writes swallow QuotaExceededError and emit `system.storage.quotaExceeded`
// via the shared activity emitter so an operator can see the failure.

import { emit } from "@/core/activity/emitter";

function hasStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

export function readJson<T>(key: string, fallback: T): T {
  if (!hasStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Persist `value` under `key`.
 *
 * Returns TRUE only when the value was durably written. A `false` return is
 * the caller's signal that the mutation did NOT persist — repositories must
 * treat it as a failure and emit no successful business event (see
 * `@/core/storage/persistence`). The `system.storage.quotaExceeded` event is
 * still emitted so the failure is visible to an operator.
 */
export function writeJson(key: string, value: unknown): boolean {
  if (!hasStorage()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emit({
      type: "system.storage.quotaExceeded",
      moduleId: "system",
      summary: `Local storage write failed for ${key}`,
      payload: { key, message },
    });
    return false;
  }
}


export function removeKey(key: string): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
