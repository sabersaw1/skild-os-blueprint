# Integration Sync, Idempotency & Provenance

## Sync state

`IntegrationSyncState` is provider-agnostic:

`integrationId`, `resourceType`, `mode`, `cursor?`, `status`,
`lastStartedAt`, `lastCompletedAt`, `lastSuccessfulAt`, `lastErrorCode`,
`lastErrorMessage`, `lastErrorRetryable`.

Modes: `full`, `incremental`, `webhook`, `poll`, `manual`. `cursor` is
optional — not every provider offers checkpointing.

Lifecycle (`service.runSync`):

```
startSync   → status running, integration.sync.started
adapter.sync
  success   → completeSync → status succeeded, integration.sync.completed
  failure   → failSync     → status failed,    integration.sync.failed
```

Syncing a connection that is not `connected` is rejected. Nothing retries
automatically in Phase 9 — failures stay visible and are retried manually.
`IntegrationError.retryable` is the contract future exponential backoff will
read; `rate_limited`, `provider_unavailable`, and `sync_failed` are retryable.

## Idempotency

`ExternalReference` maps `(provider, resourceType, externalId)` to an internal
record. `recordExternalReference` is idempotent: a repeat returns the existing
reference with `lastSeenAt` refreshed and `created: false`, and an existing
`internalId` is never silently repointed.

This is the foundation for:

- Gmail receipt → Purchase
- supplier order → Purchase
- calendar event → Appointment
- external message → Lead / conversation
- payment notification → Finance record

each of which must check the reference before creating anything internal.

## Provenance / import boundary

External data is not business truth. `Provenance` distinguishes:

`internal_verified` · `external_source` · `customer_provided` ·
`ai_suggested` · `assumption`

Imports default to `external_source`. Phase 9 establishes the distinction
only; no AI classification and no automatic promotion to verified records
exists yet. `runSync` deliberately creates **no** business records — it
records external references and returns counts. Importers land in a later
phase and must write through the owning module's repository.
