// Phase 1 placeholder identity.
// A single local "Owner" is assumed. Real authentication lands in a later phase
// and MUST replace only this file — no consumers should import auth internals
// beyond the exported `useIdentity` / `getIdentity` API.

import { createStore } from "../store";
import { OWNER_ROLE_ID } from "../roles/roles";

export type Identity = {
  id: string;
  displayName: string;
  roleId: string;
};

const DEFAULT: Identity = {
  id: "local-operator",
  displayName: "Operator",
  roleId: OWNER_ROLE_ID,
};

const identityStore = createStore<Identity>(loadFromLocal() ?? DEFAULT);

function loadFromLocal(): Identity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("skildos.identity");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.displayName === "string") {
      return { ...DEFAULT, ...parsed };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function persist(identity: Identity) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("skildos.identity", JSON.stringify(identity));
  } catch {
    /* ignore */
  }
}

export function getIdentity(): Identity {
  return identityStore.get();
}

export function useIdentity(): Identity {
  return identityStore.use();
}

export function updateIdentity(patch: Partial<Identity>) {
  identityStore.set((prev) => {
    const next = { ...prev, ...patch };
    persist(next);
    return next;
  });
}
