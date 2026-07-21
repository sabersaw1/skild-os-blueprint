// Knowledge-local versioned storage envelope.
//
// Phase 3 hard rule: every stored object is `{ schemaVersion, records }`,
// and migration hooks must exist before storage is used.
//
// Only the Knowledge repository implementation may import this file.
// Never import from components, hooks, or routes.

import { readJson, writeJson } from "@/core/storage/local-kv";

export interface Envelope<T> {
  schemaVersion: number;
  records: T[];
}

export type Migration<T> = (records: unknown[]) => T[];

interface KeyConfig<T> {
  key: string;
  currentVersion: number;
  /**
   * Migrations keyed by the FROM version. A migration at key `n` upgrades
   * records from schemaVersion `n` to `n + 1`. Chain runs from the stored
   * version up to `currentVersion`.
   */
  migrations: Record<number, Migration<unknown> | Migration<T>>;
}

const configs = new Map<string, KeyConfig<unknown>>();

/**
 * Register a versioned storage key. Must be called before `readEnvelope`
 * or `writeEnvelope` for that key. Idempotent.
 */
export function registerVersionedKey<T>(config: {
  key: string;
  currentVersion: number;
  migrations?: Record<number, Migration<T>>;
}): void {
  configs.set(config.key, {
    key: config.key,
    currentVersion: config.currentVersion,
    migrations: (config.migrations ?? {}) as Record<
      number,
      Migration<unknown>
    >,
  });
}

function requireConfig(key: string): KeyConfig<unknown> {
  const cfg = configs.get(key);
  if (!cfg) {
    throw new Error(
      `Knowledge storage: key "${key}" was read/written before being ` +
        `registered via registerVersionedKey().`,
    );
  }
  return cfg;
}

export function readEnvelope<T>(key: string): T[] {
  const cfg = requireConfig(key);
  const raw = readJson<unknown>(key, null);
  if (raw == null) return [];

  // Legacy bare array — treat as schemaVersion 0 for migration.
  let version = 0;
  let records: unknown[] = [];
  if (Array.isArray(raw)) {
    version = 0;
    records = raw;
  } else if (
    typeof raw === "object" &&
    raw !== null &&
    "schemaVersion" in raw &&
    "records" in raw &&
    Array.isArray((raw as Envelope<unknown>).records)
  ) {
    version = Number((raw as Envelope<unknown>).schemaVersion) || 0;
    records = (raw as Envelope<unknown>).records;
  } else {
    // Corrupt / unknown — start empty.
    return [];
  }

  while (version < cfg.currentVersion) {
    const migrate = cfg.migrations[version];
    if (!migrate) {
      throw new Error(
        `Knowledge storage: missing migration for key "${key}" from ` +
          `schemaVersion ${version} to ${version + 1}.`,
      );
    }
    records = (migrate as Migration<unknown>)(records);
    version += 1;
  }

  return records as T[];
}

export function writeEnvelope<T>(key: string, records: T[]): void {
  const cfg = requireConfig(key);
  const envelope: Envelope<T> = {
    schemaVersion: cfg.currentVersion,
    records,
  };
  writeJson(key, envelope);
}

/** Test-only: reset the internal registry. */
export function _resetVersionedKeys(): void {
  configs.clear();
}
