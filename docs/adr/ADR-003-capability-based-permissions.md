# ADR-003: Capability-based permissions

Status: Accepted (Phase 1).

## Context

Roles change (Owner today; Admin/Manager/Technician/Front Desk/Viewer/AI Agent later). Behavior tied to role names becomes a refactor tax every time roles shift.

## Decision

All permission checks in code target **capabilities** (`<module>.<verb>`). Roles bind to capability lists. Phase 1 ships one role (`owner`) with `"*"`.

## Consequences

- Every user-facing surface declares `requiredCapabilityIds`.
- Introducing a new capability is a two-line change.
- When real auth arrives, only `core/auth/identity.ts` changes — the check surface is unchanged.
- Alternatives rejected: role-name checks (brittle), unchecked UI (unsafe).
