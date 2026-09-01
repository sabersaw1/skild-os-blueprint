// Persistence commit helper (Phase 12.2).
//
// WHY THIS EXISTS
// ---------------
// `writeJson` used to swallow every storage failure and return `void`, so a
// repository could not tell a durable write from a dropped one. Mutations
// followed "validate → persist → emit" faithfully and still emitted a
// successful business event after a failed write — the activity log could
// claim "Payment recorded" when nothing was stored.
//
// THE CONTRACT
//   commitRecords(key, next)
//     → returns `next` when the envelope was durably written
//     → throws `PersistenceError` otherwise
//
// Repositories assign the RESULT to their in-memory collection:
//
//     records = commitRecords(KEY, [created, ...records]);
//
// so in-memory state advances only on a confirmed write. A failure leaves
// the previous records intact in memory and in storage, and — because the
// throw happens before `emit()` — no successful business event is recorded.
// `writeJson` still emits `system.storage.quotaExceeded` so the operator can
// see WHY the write failed.

import { writeEnvelope } from "./envelope";

export class PersistenceError extends Error {
  readonly code = "persistence_failed";
  constructor(readonly storageKey: string) {
    super(
      `Persistence failed for "${storageKey}". The change was not saved and ` +
        `no business event was recorded.`,
    );
    this.name = "PersistenceError";
  }
}

/**
 * Write `records` under `key`. Returns the same array on success so the
 * caller can advance its in-memory state atomically; throws
 * `PersistenceError` when the underlying storage write did not succeed.
 */
export function commitRecords<T>(key: string, records: T[]): T[] {
  if (!writeEnvelope(key, records)) throw new PersistenceError(key);
  return records;
}
