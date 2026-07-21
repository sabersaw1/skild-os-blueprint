// Public identity API. Delegates to whatever IdentityProvider is currently
// registered (see ./provider.ts). Phase 1.5: the default provider is
// LocalIdentityProvider. Later phases swap the provider — this module and
// all its consumers stay untouched.

import { useSyncExternalStore } from "react";
import {
  ANONYMOUS,
  getIdentityProvider,
  subscribeIdentityProvider,
  type Identity,
} from "./provider";

export type { Identity } from "./provider";

export function getIdentity(): Identity {
  try {
    return getIdentityProvider().get();
  } catch {
    return ANONYMOUS;
  }
}

// Subscribe to identity changes, including provider swaps.
function subscribe(listener: () => void): () => void {
  let unsubFromProvider = getIdentityProvider().subscribe(listener);
  const unsubFromRegistry = subscribeIdentityProvider(() => {
    unsubFromProvider();
    unsubFromProvider = getIdentityProvider().subscribe(listener);
    listener();
  });
  return () => {
    unsubFromProvider();
    unsubFromRegistry();
  };
}

export function useIdentity(): Identity {
  return useSyncExternalStore(subscribe, getIdentity, getIdentity);
}

export function updateIdentity(patch: Partial<Identity>) {
  const p = getIdentityProvider();
  if (!p.update) {
    throw new Error(
      `IdentityProvider "${p.kind}" does not support local updates.`,
    );
  }
  p.update(patch);
}

export function signOut(): void | Promise<void> {
  const p = getIdentityProvider();
  return p.signOut?.();
}
