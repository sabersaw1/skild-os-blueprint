// Data Registry — dependency-injection layer for repositories.
//
// Modules never import each other's concrete repository implementations.
// The Vehicles module, for example, may look up a `CustomerRepository` only
// through this registry. A repository implementation is registered once at
// bootstrap (Phase 2: local in-memory / localStorage; future phases:
// Supabase, local server, offline-first hybrid) — consumers keep working
// unchanged because they receive whatever's registered against the same key.
//
// See docs/data-registry.md for the full contract.

const registry = new Map<string, unknown>();
const listeners = new Map<string, Set<() => void>>();

/**
 * Repository key. Modules define one string constant per repository they
 * publish (e.g. `CRM_CUSTOMER_REPOSITORY = "crm.customerRepository"`) and
 * export it alongside the interface.
 */
export type RepositoryKey = string;

export function registerRepository<T>(key: RepositoryKey, impl: T): void {
  registry.set(key, impl as unknown);
  listeners.get(key)?.forEach((l) => l());
}

/**
 * Retrieve a registered repository. Throws if the key was never registered
 * — a missing key is always a bootstrap ordering bug, never a runtime
 * fallback.
 */
export function getRepository<T>(key: RepositoryKey): T {
  if (!registry.has(key)) {
    throw new Error(
      `Data registry: no repository registered for key "${key}". ` +
        `Ensure the owning module's bootstrap ran before this call.`,
    );
  }
  return registry.get(key) as T;
}

export function hasRepository(key: RepositoryKey): boolean {
  return registry.has(key);
}

/** Test-only: remove a registered repository (or all of them if omitted). */
export function clearRepository(key?: RepositoryKey): void {
  if (key === undefined) {
    for (const k of Array.from(registry.keys())) {
      registry.delete(k);
      listeners.get(k)?.forEach((l) => l());
    }
    return;
  }
  registry.delete(key);
  listeners.get(key)?.forEach((l) => l());
}

/** Subscribe to swaps for a key. Fires after `registerRepository`/`clearRepository`. */
export function subscribeRepository(
  key: RepositoryKey,
  listener: () => void,
): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
  };
}
