# ADR-002: Registry-driven modules

Status: Accepted (Phase 1).

## Context

Skild OS will grow to a dozen+ modules (CRM, Vehicles, Inspections, Jobs, Parts, Finance, Marketing, Knowledge, AI, Automation, Analytics, Admin). The shell must not know about any of them by name.

## Decision

Every module declares a single `ModuleManifest` and calls `registerModule()` at bootstrap. The shell reads nav entries, commands, settings sections, and dashboard widgets from registries — never by importing modules.

## Consequences

- Adding a module is additive; no shell changes.
- Removing a module is a single-line change at bootstrap.
- Cross-module dependencies must go through `core/*` interfaces (auth, activity, sync, storage, capabilities), never direct module-to-module imports.
- Alternatives rejected: folder-scan discovery (magic, harder to trace), route-only registration (misses commands/settings/widgets).
