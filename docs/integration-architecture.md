# Integration Architecture

## Boundary

```
External provider
   ↓  (adapter — the only vendor-aware code)
IntegrationAdapter
   ↓  (normalized external record + external reference)
Import boundary / validation
   ↓
Existing module repository (Parts, Finance, CRM, …)
   ↓
Business record + activity event
```

Forbidden:

```
External provider → localStorage → business record
```

Adapters never write to storage, never touch `localStorage`, and never import
a module repository implementation. `src/core/integrations/boundaries.test.ts`
enforces this statically.

## Adapter contract

`IntegrationAdapter` (`src/core/integrations/adapter.ts`):

- `providerId`, `displayName`, `kind` (`stub` | `live`)
- `capabilities` — supported `syncModes`, readable/writable resources,
  whether authorization needs user interaction
- `connect()`, `disconnect()`, `getStatus()`, `testConnection()`
- optional `sync()` returning `NormalizedExternalRecord[]`

## Registry

`getIntegrationAdapter("google.gmail")` resolves by provider id.
`registerIntegrationAdapter(...)` replaces an implementation — that is how
tests swap in stubs and how a live adapter later replaces a deferred one.
Business modules must never construct a provider implementation directly.

## Connection states

`disconnected → connecting → connected | error | revoked | expired`

Transitions are validated in `connection-state.ts`. A failed adapter call
always lands the connection in `error` with a safe code and message, so a
broken connection can never render as healthy. Deferred providers stay in
`error: configuration_missing` rather than pretending to connect.

## Storage

Versioned envelopes via `@/core/storage/envelope`, migrations registered
before first read/write:

- `skildos.integrations.connections.v1`
- `skildos.integrations.syncstates.v1`
- `skildos.integrations.externalrefs.v1`

## Human control

Phase 9 deliberately implements no consequential autonomous action.
Connecting an account is an explicit operator action gated by
`integrations.connect`. Future consequential actions (customer messaging,
publishing, purchasing, payments, refunds) must each carry their own
capability and approval boundary before implementation.

## Future compatibility check

| Question | Answer |
| --- | --- |
| Can Gmail/supplier integrations create purchases without a second financial system? | Yes — importers write through the existing Parts/Finance repositories. No new money or purchase representation was introduced. |
| Can supplier adapters create purchases through the Parts repository? | Yes — via the Data Registry, same as any other consumer. |
| Can Calendar sync without Google becoming the source of truth? | Yes — `IntegrationSyncState` + `ExternalReference` map external events to internal records; the OS record is authoritative. |
| Can the website send leads in without merging the apps? | Yes — a `website` adapter with `webhook` sync mode, normalized to external records, then validated into CRM. |
| Can Gmail ingestion identify duplicates? | Yes — `ExternalReference(provider, resourceType, externalId)` is idempotent. |
| Can Jarvis inspect connection health without seeing secrets? | Yes — connection and sync records contain no credential material at all. |
| Can agents operate integrations through capabilities? | Yes — all actions are gated by `integrations.*`, never by raw credentials. |
| Is every action auditable? | Yes — actor is captured by the activity emitter; events carry provider, operation, ids, and result. |
