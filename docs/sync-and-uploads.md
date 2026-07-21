# Sync Engine & Upload Queue

Skild Auto is a mobile mechanic business. The Sync Engine and Upload Queue exist so field flows in later phases can be built against a stable local-first contract from day one.

## Sync Engine (`src/sync/outbox.ts`)

- `enqueueOutbox({ entity, op, payload, idempotencyKey })` returns an `OutboxItem`.
- Dedupe: enqueuing with an existing `idempotencyKey` returns the previous item.
- Statuses: `pending → syncing → done | failed`.
- Phase 1: no transport is attached. Items sit in the local queue.

## Upload Queue (`src/storage/uploadQueue.ts`)

- `enqueueUpload({ logicalKey, size, checksum })` returns an `UploadJob`.
- Logical keys look like `inspections/{inspectionId}/photos/{uuid}.jpg` — never provider URLs.
- Phase 1: no storage provider is wired. Jobs sit in the local queue.

## Rules (enforced in later phases)

- Server is authoritative. Local writes are proposals until acknowledged.
- Conflicts produce a `ConflictRecord` for human resolution — never silent overwrites.
- Uploads chunk and resume with backoff; originals retained locally until the server ACKs.
- The queue status is always visible in the shell top bar.

## Status UI

`AppShell` renders a `StatusIndicator` that reads both queues. In Phase 1 it always reports "Idle — local only" until something is enqueued.
