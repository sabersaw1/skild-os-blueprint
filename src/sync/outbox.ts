// Sync Engine — Phase 1 skeleton.
// Interfaces + in-memory queue only. No network, no server, no persistence.
// Later phases attach a real transport and conflict resolution.

import { createStore } from "@/core/store";

export type OutboxOp = "create" | "update" | "delete";
export type OutboxStatus = "pending" | "syncing" | "failed" | "done";

export type OutboxItem = {
  id: string;
  entity: string; // e.g. "customer"
  op: OutboxOp;
  payload: unknown;
  idempotencyKey: string;
  attempts: number;
  lastError?: string;
  status: OutboxStatus;
  enqueuedAt: number;
};

const store = createStore<OutboxItem[]>([]);

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function enqueueOutbox(
  input: Omit<OutboxItem, "id" | "attempts" | "status" | "enqueuedAt">,
): OutboxItem {
  // Dedupe by idempotency key.
  const existing = store.get().find((i) => i.idempotencyKey === input.idempotencyKey);
  if (existing) return existing;
  const item: OutboxItem = {
    id: makeId(),
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
