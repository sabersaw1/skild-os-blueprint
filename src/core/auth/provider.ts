// IdentityProvider abstraction.
// The shell only ever talks to whatever provider is currently registered via
// `setIdentityProvider(...)`. Phase 1.5 ships the LocalIdentityProvider as the
// default; Phase 2+ can drop in a Supabase (or self-hosted) provider without
// touching any consumer.
//
// Contract:
//   - `get()` returns the current identity synchronously (may be Anonymous).
//   - `subscribe(listener)` fires whenever the identity changes.
//   - `update(patch)` is optional — providers that manage identity remotely
//     (e.g. OAuth) may throw or no-op here.
//   - `signOut()` is optional — the local provider resets to defaults.
//
// No consumer should import a concrete provider directly.

import { createStore } from "../store";
import { OWNER_ROLE_ID } from "../roles/roles";

export type Identity = {
  id: string;
  displayName: string;
  roleId: string;
};

export const ANONYMOUS: Identity = {
  id: "anonymous",
  displayName: "Anonymous",
  roleId: "anonymous",
};

export interface IdentityProvider {
  readonly kind: string;
  get(): Identity;
  subscribe(listener: () => void): () => void;
  update?(patch: Partial<Identity>): void;
  signOut?(): void | Promise<void>;
}

// ---- Local (Phase 1) provider --------------------------------------------

const LOCAL_KEY = "skildos.identity";
const DEFAULT_LOCAL: Identity = {
  id: "local-operator",
  displayName: "Operator",
  roleId: OWNER_ROLE_ID,
};

function loadLocal(): Identity {
  // Phase 15: routed through the StorageDriver seam so a non-browser host
  // (test worker, future server bootstrap) resolves an identity too.
  const driver = getStorageDriver();
  if (!driver.available()) return DEFAULT_LOCAL;
  try {
    const raw = driver.read(LOCAL_KEY);
    if (!raw) return DEFAULT_LOCAL;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.displayName === "string") {
      return { ...DEFAULT_LOCAL, ...parsed };
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCAL;
}

function persistLocal(identity: Identity) {
  const driver = getStorageDriver();
  if (!driver.available()) return;
  driver.write(LOCAL_KEY, JSON.stringify(identity));
}


export function createLocalIdentityProvider(): IdentityProvider {
  const store = createStore<Identity>(loadLocal());
  return {
    kind: "local",
    get: () => store.get(),
    subscribe: (l) => store.subscribe(l),
    update(patch) {
      store.set((prev) => {
        const next = { ...prev, ...patch };
        persistLocal(next);
        return next;
      });
    },
    signOut() {
      persistLocal(DEFAULT_LOCAL);
      store.set(DEFAULT_LOCAL);
    },
  };
}

// ---- Provider registry ---------------------------------------------------

const providerStore = createStore<IdentityProvider>(
  createLocalIdentityProvider(),
);

export function setIdentityProvider(provider: IdentityProvider) {
  providerStore.set(provider);
}

export function getIdentityProvider(): IdentityProvider {
  return providerStore.get();
}

export function subscribeIdentityProvider(listener: () => void): () => void {
  return providerStore.subscribe(listener);
}
