# Roles & Permissions

Skild OS uses **capability-based** permissions. Code checks a capability, never a role name.

## Capabilities

- Named `<module>.<verb>`: `customers.read`, `jobs.write`, `finance.approve`.
- Registered by the owning module in its manifest.
- The Shell owns: `shell.navigate`, `commands.run`, `activity.read`, `settings.read`, `settings.write`.

## Roles

- A `Role` is an id + name + capability list. `capabilityIds: "*"` grants all.
- Phase 1 defines one role: `owner` with `"*"`. The local identity is bound to it.
- Later phases add: Admin, Manager, Technician, Front Desk, Viewer, AI Agent (non-human principal).

## Checking

```ts
import { hasCapability, hasAll } from "@/core/roles/roles";
import { getIdentity } from "@/core/auth/identity";

const id = getIdentity();
if (hasCapability(id.roleId, "customers.write")) {
  // …
}
```

## Rules

- **Never** compare role name in code. Bind behavior to capabilities.
- Every user-facing surface declares `requiredCapabilityIds` in its manifest.
- Introducing a new capability is a two-line change (register + reference in the surface).
- When real auth arrives, only `core/auth/identity.ts` changes.

## Where capabilities are enforced (Phase 12.2)

Capability checks are no longer UI-only. Consequential repository mutations
are wrapped with `withCapabilityEnforcement()` so a non-UI caller (agent,
adapter, scheduled command) is denied before any validation, mutation,
persistence, or activity emission. UI checks remain, but they are advisory.

See [architecture/repository-authorization.md](./architecture/repository-authorization.md).
