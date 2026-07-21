// Minimal external store helper used by all Phase 1 registries.
// No external state library — one tiny helper that plays with React 19's
// useSyncExternalStore.

import { useSyncExternalStore } from "react";

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
    const sel = selector ?? ((s: T) => s);
    return useSyncExternalStore(
      subscribe,
      () => sel(state),
      () => sel(state),
    );
  }

  return { get, set, subscribe, use: use as Store<T>["use"] };
}
