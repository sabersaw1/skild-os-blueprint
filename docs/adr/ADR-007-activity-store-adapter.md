# ADR-007: ActivityStore Persistence Adapter

**Status:** Accepted (Phase 1.5)

## Context

Phase 1 stored activity events in an in-memory ring buffer. All events are
lost on reload. Once modules start emitting security-relevant events
(auth, permission denials, financial approvals), volatile storage is a
compliance risk.

## Decision

Introduce an `ActivityStore` interface (`src/core/activity/store-adapter.ts`):

```ts
interface ActivityStore {
  kind: string;
  append(evt: ActivityEvent): void | Promise<void>;
  list(): ActivityEvent[];
  clear(): void | Promise<void>;
  subscribe(listener: () => void): () => void;
}
```

The default adapter is the existing in-memory ring buffer
(`createInMemoryActivityStore`, capacity 500). `emit()` and `useActivity()`
never touch storage directly — they delegate to whatever adapter is
registered via `setActivityStore(...)`.

Later phases can register:

- IndexedDB adapter (browser durability)
- Supabase adapter (server durability, cross-device)
- Self-hosted server adapter (Stage 3 of the storage migration plan)

## Consequences

- Emit call sites never change when durability improves.
- `list()` returns a snapshot array; adapters that back onto async storage
  MUST keep an in-memory cache to serve `list()` synchronously.
- Adapter swap fires the subscription in `emitter.ts`, so `useActivity()`
  re-renders cleanly on a swap.
