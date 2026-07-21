// Activity Log — Phase 1 sink is an in-memory ring buffer.
// Every state-changing UI action should call `emit(...)`.
// Later phases replace the sink with persistent storage; the emit API stays.

import { createStore } from "../store";
import { getIdentity } from "../auth/identity";

export type ActivityEvent = {
  id: string;
  at: number; // epoch ms
  actorId: string;
  type: string; // e.g. "navigation", "settings.change", "command.run"
  moduleId: string;
  summary: string;
  payload?: Record<string, unknown>;
};

const MAX_EVENTS = 500;

const store = createStore<ActivityEvent[]>([]);

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function emit(
  input: Omit<ActivityEvent, "id" | "at" | "actorId"> &
    Partial<Pick<ActivityEvent, "actorId">>,
) {
  const evt: ActivityEvent = {
    id: makeId(),
    at: Date.now(),
    actorId: input.actorId ?? getIdentity().id,
    type: input.type,
    moduleId: input.moduleId,
    summary: input.summary,
    payload: input.payload,
  };
  store.set((prev) => {
    const next = [evt, ...prev];
    return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
  });
}

export function useActivity(): ActivityEvent[] {
  return store.use();
}

export function clearActivity() {
  store.set([]);
}
