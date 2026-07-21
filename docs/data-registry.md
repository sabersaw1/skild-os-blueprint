# Data Registry

The Data Registry (`src/core/data/registry.ts`) is a dependency-injection
layer for repositories. Modules never import concrete storage implementations
directly; they retrieve a repository by string key at runtime.

## Rules

- **One key per repository**, exported from the repository interface file
  (e.g. `CRM_CUSTOMER_REPOSITORY`, `VEHICLES_REPOSITORY`).
- **Register at bootstrap only.** `registerRepository` runs from a module's
  `register…Module()` function, which is invoked from `src/core/bootstrap.ts`.
- **Consumers use hooks.** UI code calls `useCustomerRepository()` /
  `useVehicleRepository()` (module hooks), never `getRepository()` directly
  from a component render body.
- **Swap in tests.** Vitest suites register a fake implementation before
  exercising the module; production wiring is untouched.

## Why

- Phase 2 uses `localStorage`-backed repositories.
- Phase 5 will replace them with Supabase-backed implementations.
- Phase N may add a private-server adapter.

No consumer needs to change when the adapter changes — only the bootstrap
registration.
