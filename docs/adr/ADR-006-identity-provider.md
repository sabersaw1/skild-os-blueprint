# ADR-006: IdentityProvider Abstraction

**Status:** Accepted (Phase 1.5)

## Context

Phase 1 shipped a hard-coded local "Operator" identity in
`src/core/auth/identity.ts`. Phase 2+ will introduce Supabase-backed auth,
and later a self-hosted identity provider. Consumers scattered across the
shell (activity emitter, command registry, settings registry, sidebar,
route guards) all reach for `getIdentity()` / `useIdentity()`.

Swapping the identity source cannot mean editing every consumer.

## Decision

Introduce an `IdentityProvider` interface (`src/core/auth/provider.ts`):

```ts
interface IdentityProvider {
  kind: string;
  get(): Identity;
  subscribe(listener: () => void): () => void;
  update?(patch: Partial<Identity>): void;
  signOut?(): void | Promise<void>;
}
```

`identity.ts` delegates entirely to whatever provider is currently
registered via `setIdentityProvider(...)`. Phase 1.5 registers
`LocalIdentityProvider` by default. Phase 2 will register a Supabase
provider from the app bootstrap without any consumer change.

`useIdentity()` re-subscribes automatically when the provider is swapped,
so a provider change re-renders every consumer.

## Consequences

- Consumers keep using `getIdentity()` / `useIdentity()` / `updateIdentity()`.
- New providers implement one interface, no consumer edits.
- Providers that don't support local mutation (e.g. OAuth) throw from
  `update()`. UI that offers profile editing must handle that.
- `Identity` shape is part of the frozen v1 contract; adding required
  fields requires a follow-up ADR.
