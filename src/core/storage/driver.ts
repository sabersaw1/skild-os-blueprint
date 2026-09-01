// Storage driver abstraction (Phase 13.5).
//
// WHY THIS EXISTS
// ---------------
// The Phase 13 audit found that `writeJson` returned `false` whenever no DOM
// was present, so ANY mutation executed outside a browser tab — an SSR
// render, a test worker, and (in a future phase) a scheduled background run
// — threw `PersistenceError`. That is the correct failure for a browser
// store that genuinely cannot write, but it made the persistence layer
// structurally unable to host background execution.
//
// The fix is a driver seam, not a backend. `local-kv` no longer talks to
// `window.localStorage`; it talks to whatever `StorageDriver` is currently
// installed. Today that is the browser driver. A future phase can install a
// server/file/SQLite driver at bootstrap without touching a single
// repository, and the "authorize → validate → persist → CONFIRM → emit"
// invariant holds identically on both.
//
// WHAT THIS IS NOT
//   • It is not a cloud dependency: no vendor is named here or anywhere
//     below it.
//   • It is not a fake store: a driver that cannot durably write returns
//     `false` from `write`, which repositories surface as `PersistenceError`.
//     Silence is never an option.
//   • It does NOT enable background execution. Nothing installs a non-browser
//     driver at runtime; the memory driver exists for tests and for the
//     future server bootstrap to opt into explicitly.

export interface StorageDriver {
  /** Stable identifier, used in diagnostics and tests. */
  readonly id: string;
  /**
   * Does this driver survive a process/tab restart? The memory driver says
   * `false` — a future server driver would say `true`. Nothing branches on
   * it today; it exists so an operator surface can tell the truth.
   */
  readonly durable: boolean;
  /** Can this driver be used right now? */
  available(): boolean;
  /** Returns the raw stored string, or `null` when absent/unavailable. */
  read(key: string): string | null;
  /** TRUE only when the value was actually stored. */
  write(key: string, value: string): boolean;
  remove(key: string): void;
}

function hasLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

/** The default driver: browser `localStorage`. Local-first, no server. */
export const browserStorageDriver: StorageDriver = {
  id: "browser.localStorage",
  durable: true,
  available: hasLocalStorage,
  read(key) {
    if (!hasLocalStorage()) return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  write(key, value) {
    if (!hasLocalStorage()) return false;
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    if (!hasLocalStorage()) return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

/**
 * A driver that depends on NO browser global. Used by tests to prove that
 * the persistence contract is environment-independent, and available to a
 * future server/background bootstrap as the base for a durable
 * implementation (file, SQLite, Postgres — none of which exist yet).
 */
export function createMemoryStorageDriver(
  seed?: Record<string, string>,
): StorageDriver & { snapshot(): Record<string, string> } {
  const map = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    id: "memory",
    durable: false,
    available: () => true,
    read: (key) => (map.has(key) ? map.get(key)! : null),
    write: (key, value) => {
      map.set(key, value);
      return true;
    },
    remove: (key) => {
      map.delete(key);
    },
    snapshot: () => Object.fromEntries(map.entries()),
  };
}

/**
 * A driver that always refuses to write. Exists so the failure path
 * ("persistence not confirmed → PersistenceError → no business event") is
 * testable without corrupting a real store.
 */
export function createFailingStorageDriver(): StorageDriver {
  return {
    id: "failing",
    durable: false,
    available: () => true,
    read: () => null,
    write: () => false,
    remove: () => {},
  };
}

let current: StorageDriver = browserStorageDriver;

export function getStorageDriver(): StorageDriver {
  return current;
}

/**
 * Install a driver. Called once at bootstrap by whichever host is running
 * (browser today; a server/background host later). Never called from a
 * component, a repository, or a domain module.
 */
export function setStorageDriver(driver: StorageDriver): void {
  current = driver;
}

/** Restore the default browser driver. */
export function resetStorageDriver(): void {
  current = browserStorageDriver;
}
