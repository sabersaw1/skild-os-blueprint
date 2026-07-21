// Minimal external store helper used by all Phase 1 registries.
// No external state library — one tiny helper that plays with React 19's
// useSyncExternalStore.
//
// Snapshot caching (Phase 3.1):
//   Selectors that return derived arrays/objects (e.g. `Object.values(s).sort(...)`)
//   produce a new reference on every call. Without caching, useSyncExternalStore
//   sees a different snapshot on every render check and enters an infinite loop
//   ("The result of getServerSnapshot should be cached to avoid an infinite loop").
//   We cache per component instance keyed by the underlying state reference:
//   the state reference only changes when `set()` runs, so the cached result
//   is safe to reuse until the next mutation.

import { useRef, useSyncExternalStore } from "react";

export type Store<T> = {
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  subscribe: (listener: () => void) => () => void;
  use: {
    (): T;
    <S>(selector: (state: T) => S): S;
  };
};

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();

  const get = () => state;
  const set: Store<T>["set"] = (next) => {
    state =
      typeof next === "function" ? (next as (p: T) => T)(state) : next;
    listeners.forEach((l) => l());
  };
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  };

  function use<S>(selector?: (state: T) => S): S | T {
    const sel = selector ?? ((s: T) => s as unknown as S);
    // Per-hook-instance cache: reuse the last computed result if the
    // underlying state reference has not changed. Selectors must be pure.
    const cache = useRef<{ state: T; result: S } | null>(null);
    const getSnapshot = (): S => {
      const s = state;
      const c = cache.current;
      if (c && Object.is(c.state, s)) return c.result;
      const result = sel(s);
      cache.current = { state: s, result };
      return result;
    };
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  }

  return { get, set, subscribe, use: use as Store<T>["use"] };
}
