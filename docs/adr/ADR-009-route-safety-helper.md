# ADR-009: Route Safety Helper for Modules

**Status:** Accepted (Phase 1.5)

## Context

TanStack Start requires every route with a loader to define
`errorComponent` and `notFoundComponent`. Phase 1 routes have no loaders,
so this is latent. Once Phase 2 modules start loading data, forgetting
these boundaries silently produces blank screens or unhandled errors.

## Decision

Introduce `createModuleRoute()` in `src/core/routes/createModuleRoute.ts`.
It wraps `createFileRoute()` and:

- Requires an explicit `moduleId` in options (auditability).
- Auto-provides `errorComponent` and `notFoundComponent` defaults.
- Lets modules override either default freely.

Business modules MUST use `createModuleRoute()` rather than
`createFileRoute()` directly. Shell routes (root, settings hub, activity)
may keep `createFileRoute()` since they own their fallbacks.

## Consequences

- Zero-boilerplate default safety net for every module route.
- Reviewers can grep for `createFileRoute` outside `src/routes/` (shell)
  to catch bypasses.
- The wrapper is intentionally thin — it does not hide any TanStack API,
  only defaults required boundaries.
