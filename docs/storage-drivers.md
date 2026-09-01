# Storage Drivers (Phase 13.5)

## Why

Before Phase 13.5, `writeJson()` talked directly to `window.localStorage`.
With no DOM — an SSR render, a test worker, or (later) a background run —
every write returned `false`, which repositories correctly escalated to
`PersistenceError`. The persistence layer was therefore structurally unable
to host anything outside a browser tab.

Phase 13.5 introduces a **seam**, not a backend.

## The contract

`src/core/storage/driver.ts`

```ts
interface StorageDriver {
  readonly id: string;
  readonly durable: boolean;   // survives a process/tab restart?
  available(): boolean;
  read(key: string): string | null;
  write(key: string, value: string): boolean;  // TRUE only if durably stored
  remove(key: string): void;
}
```

`local-kv` reads the installed driver on every call. Layering is unchanged:

```
repository → envelope (schemaVersion) → local-kv → StorageDriver
```

## Shipped drivers

| Driver | id | durable | Used by |
|---|---|---|---|
| `browserStorageDriver` | `browser.localStorage` | yes | Default — the app |
| `createMemoryStorageDriver()` | `memory` | no | Tests; a future server bootstrap's base |
| `createFailingStorageDriver()` | `failing` | no | Tests of the failure path |

`setStorageDriver()` is called **once at bootstrap by the host**. Never from a
component, hook, repository, or domain module.

## Invariant preserved

```
authorize → validate → persist → CONFIRM → emit
```

A driver that cannot durably write returns `false`. `local-kv` emits
`system.storage.quotaExceeded` (frozen event name) with the driver id and
message, `assertPersisted` / `commitRecords` throw `PersistenceError`, and no
business event is emitted. Silence is never an option.

## What this does not do

- It names no vendor and adds no network dependency.
- It does not enable background execution — nothing installs a non-browser
  driver at runtime.
- It is not a fake store: an unavailable driver fails loudly.
