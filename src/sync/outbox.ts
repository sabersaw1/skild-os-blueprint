// Sync Engine — Phase 1.5 skeleton.
// Interfaces + in-memory queue only. No network, no server, no persistence.
// A durable transport lands in a later phase.
//
// Every enqueued item carries `schemaVersion` so a durable adapter can
// migrate old payloads forward without ambiguity. Registered migrations
// run automatically when items are hydrated from storage.

import { createStore } from "@/core/store";

/**
 * Bump when the shape of `OutboxItem.payload` for a given `entity` changes
 * in a non-backward-compatible way. Register a migration below.
 */
export const OUTBOX_SCHEMA_VERSION = 1;

export type OutboxOp = "create" | "update" | "delete";
export type OutboxStatus = "pending" | "syncing" | "failed" | "done";

export type OutboxItem = {
  id: string;
  schemaVersion: number;
  entity: string; // e.g. "customer"
  op: OutboxOp;
  payload: unknown;
  idempotencyKey: string;
  attempts: number;
  lastError?: string;
  status: OutboxStatus;
  enqueuedAt: number;
};

/**
 * A migration transforms one item written at `fromVersion` into an item at
 * `fromVersion + 1`. Runners must be pure and idempotent.
 */
export type OutboxMigration = {
  fromVersion: number;
  migrate: (item: OutboxItem) => OutboxItem;
};

const migrations: OutboxMigration[] = [];

export function registerOutboxMigration(m: OutboxMigration) {
  if (migrations.some((x) => x.fromVersion === m.fromVersion)) {
    throw new Error(
      `Outbox migration for version ${m.fromVersion} already registered.`,
    );
  }
  migrations.push(m);
  migrations.sort((a, b) => a.fromVersion - b.fromVersion);
}

/** Apply every migration whose fromVersion >= item.schemaVersion. */
export function migrateOutboxItem(item: OutboxItem): OutboxItem {
  let current = item;
  while (current.schemaVersion < OUTBOX_SCHEMA_VERSION) {
    const step = migrations.find((m) => m.fromVersion === current.schemaVersion);
    if (!step) {
      throw new Error(
        `No outbox migration from schemaVersion ${current.schemaVersion} to ${current.schemaVersion + 1}.`,
      );
    }
    current = { ...step.migrate(current), schemaVersion: current.schemaVersion + 1 };
  }
  return current;
}

const store = createStore<OutboxItem[]>([]);

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function enqueueOutbox(
  input: Omit<
    OutboxItem,
    "id" | "attempts" | "status" | "enqueuedAt" | "schemaVersion"
  >,
): OutboxItem {
  // Dedupe by idempotency key.
  const existing = store
    .get()
    .find((i) => i.idempotencyKey === input.idempotencyKey);
  if (existing) return existing;
  const item: OutboxItem = {
    id: makeId(),
    schemaVersion: OUTBOX_SCHEMA_VERSION,
    attempts: 0,
    status: "pending",
    enqueuedAt: Date.now(),
    ...input,
  };
  store.set((prev) => [...prev, item]);
  return item;
}

export function useOutbox(): OutboxItem[] {
  return store.use();
}

export function outboxSize(): number {
  return store.get().length;
}
