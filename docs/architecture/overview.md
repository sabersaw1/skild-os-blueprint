# Architecture Overview (Phase 1 delta)

See the approved v2 Master Architecture Document for the full plan. This file records what Phase 1 actually shipped.

## Delivered in Phase 1

- Application shell: sidebar (desktop, collapsible-icon), bottom nav (mobile), top bar with Command Bar trigger, sync/upload status indicator, identity chip.
- Routes: `/` Command Center, `/activity`, `/settings` layout with `/settings/profile`, `/settings/appearance`, `/settings/modules`.
- Registries (in-memory singletons, subscribable via React 19 `useSyncExternalStore`):
  - `core/modules/registry` — module manifests, nav entries, dashboard widgets.
  - `core/commands/registry` — Command Bar commands.
  - `core/settings/registry` — Settings hub sections.
  - `core/activity/emitter` — activity feed (ring buffer of 500).
  - `core/roles/roles` — capabilities + roles (single "Owner" role in Phase 1).
- `core/auth/identity` — placeholder local operator identity.
- `sync/outbox` — Sync Engine skeleton with idempotency-key dedupe.
- `storage/uploadQueue` — Upload Queue skeleton.
- Bootstrap: `core/bootstrap.ts` registers the Shell's own manifest so the contract is exercised end-to-end.

## Explicitly not in Phase 1

Authentication, database, external services, uploads to real storage, CRM/Vehicles/Inspections/Jobs/Parts/Finance/AI/Automation/Portal modules.

## Contracts introduced

Every future module registers a `ModuleManifest`. See `docs/module-contract.md`.
