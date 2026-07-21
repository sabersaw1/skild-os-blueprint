# ADR-001: TanStack Start as the app framework

Status: Accepted (Phase 1).

## Context

Skild OS needs an SSR-capable React framework with a strong routing story, file-based routes, and per-route metadata, deployable to an edge runtime, and compatible with the future path to hybrid/local hosting.

## Decision

Adopt TanStack Start v1 (React 19, Vite 7) as scaffolded by the template.

## Consequences

- File-based routing under `src/routes/`. `src/routeTree.gen.ts` is generated — never authored.
- Per-route `head()` is the canonical place for title/description/og metadata.
- Server functions are reserved for later phases; Phase 1 has none.
- Deployment target is an edge worker (nodejs_compat); Node-only packages are avoided.
