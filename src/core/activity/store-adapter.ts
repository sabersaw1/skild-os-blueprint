// ActivityStore adapter interface.
// The emitter never touches storage directly — it goes through the currently
// registered ActivityStore. Phase 1.5 ships an in-memory ring-buffer adapter
// as the default; later phases can register an IndexedDB, Supabase, or local
// server adapter without touching emit() call sites.

import { createStore } from "../store";
import type { ActivityEvent } from "./types";

export interface ActivityStore {
  readonly kind: string;
  append(evt: ActivityEvent): void | Promise<void>;
  list(): ActivityEvent[];
  clear(): void | Promise<void>;
  subscribe(listener: () => void): () => void;
}

// ---- In-memory ring buffer (default) -------------------------------------

const MAX_EVENTS = 500;

export function createInMemoryActivityStore(
  capacity: number = MAX_EVENTS,
): ActivityStore {
  const store = createStore<ActivityEvent[]>([]);
  return {
    kind: "memory",
    append(evt) {
      store.set((prev) => {
        const next = [evt, ...prev];
        return next.length > capacity ? next.slice(0, capacity) : next;
      });
    },
    list: () => store.get(),
    clear() {
      store.set([]);
    },
    subscribe: (l) => store.subscribe(l),
  };
}

// ---- Adapter registry ----------------------------------------------------

const adapterStore = createStore<ActivityStore>(createInMemoryActivityStore());

export function setActivityStore(store: ActivityStore) {
  adapterStore.set(store);
}

export function getActivityStore(): ActivityStore {
  return adapterStore.get();
}

export function subscribeActivityStoreRegistry(listener: () => void) {
  return adapterStore.subscribe(listener);
}
