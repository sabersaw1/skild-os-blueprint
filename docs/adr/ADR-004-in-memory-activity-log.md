# ADR-004: In-memory Activity Log in Phase 1

Status: Accepted (Phase 1).

## Context

The Activity Log is the audit substrate. It must exist from day one so modules develop the habit of emitting for every write. But Phase 1 has no database.

## Decision

Ship the emit API and feed UI backed by an in-memory ring buffer capped at 500 events. Cleared on refresh. Every state-changing action still emits.

## Consequences

- Modules built in later phases already emit correctly; no retrofit.
- When the data layer arrives, only the sink inside `core/activity/emitter.ts` changes.
- Users understand the buffer is ephemeral in Phase 1 (surfaced in the Activity page copy).
- Alternatives rejected: `localStorage` sink (misleading — implies durability), no log at all (loses the emit habit).
