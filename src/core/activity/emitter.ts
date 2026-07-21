// Activity Log emitter — thin wrapper over the currently registered
// ActivityStore adapter (see ./store-adapter.ts). Callers only see
// `emit()`, `useActivity()`, and `clearActivity()`.

import { useSyncExternalStore } from "react";
import { getIdentity } from "../auth/identity";
import {
  getActivityStore,
  subscribeActivityStoreRegistry,
} from "./store-adapter";
import type { ActivityEvent } from "./types";

export type { ActivityEvent } from "./types";

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
  void getActivityStore().append(evt);
}

// Subscribe across both the adapter and any adapter swap.
function subscribe(listener: () => void): () => void {
  let unsub = getActivityStore().subscribe(listener);
  const unsubRegistry = subscribeActivityStoreRegistry(() => {
    unsub();
    unsub = getActivityStore().subscribe(listener);
    listener();
  });
  return () => {
    unsub();
    unsubRegistry();
  };
}

const getSnapshot = () => getActivityStore().list();

export function useActivity(): ActivityEvent[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function clearActivity() {
  void getActivityStore().clear();
}
