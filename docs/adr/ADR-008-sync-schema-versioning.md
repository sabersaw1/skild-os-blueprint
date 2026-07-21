# ADR-008: Sync Outbox & Upload Queue Schema Versioning

**Status:** Accepted (Phase 1.5)

## Context

Phase 1 skeletons for `src/sync/outbox.ts` and `src/storage/uploadQueue.ts`
had no version marker on queued items. The first real module to write
payloads would define a de-facto schema, and any later change to that
shape would silently corrupt hydrated data.

## Decision

Both queues expose a numeric constant and a migration hook:

- `OUTBOX_SCHEMA_VERSION` and `registerOutboxMigration({ fromVersion, migrate })`
- `UPLOAD_QUEUE_SCHEMA_VERSION` and `registerUploadMigration({ fromVersion, migrate })`

Every item / job carries its own `schemaVersion`. The pure functions
`migrateOutboxItem()` and `migrateUploadJob()` apply registered migrations
step-by-step until an item matches the current constant. A missing migration
throws — silent data loss is forbidden.

### Rules

1. Bump the constant when you make a **non-backward-compatible** change to
   `payload` shape or item semantics.
2. Register a migration `{ fromVersion: N, migrate }` in the same commit
   that bumps the constant from `N` to `N+1`.
3. Migrations must be **pure and idempotent**.
4. Never delete a migration — durable adapters may still hold ancient items.

## Consequences

- Migrations exist even before durable storage is implemented, so the
  storage adapter has nothing new to invent.
- Small code cost today, no data-loss risk when storage lands.
