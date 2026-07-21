# Quotes — Versioning

Phase 5

## Guarantees

1. **Every quote has at least one version.** `createQuote` seeds v1 with
   `changeReason = "Initial version"`.
2. **Versions are immutable.** `QuoteVersion.snapshot` is a deep copy of the
   quote at the time it was recorded; there is no `updateVersion` API.
3. **`currentVersion` is monotonic.** Only `updateQuote` bumps it, and it
   always bumps by exactly 1.
4. **`changeReason` is mandatory** on every `updateQuote` call; the
   repository throws if it's missing or blank.
5. **Only drafts are versionable.** `updateQuote` rejects any quote whose
   status is not `draft`, so a `sent`/`approved`/`declined`/`expired` quote
   is a stable historical record.

## Snapshot shape

`QuoteSnapshot` excludes derived audit fields (`statusHistory`,
`currentVersion`, `createdAt`, `updatedAt`, `createdBy`) so a version is
the *proposal state*, not the *record state*. Downstream systems that need
to reproduce a customer-facing document should render from the snapshot,
not from the live quote.

## Storage

Versions live in the `skildos.quotes.versions.v1` envelope, one row per
version. The list route reads them via `listVersions(quoteId)` sorted
ascending by `versionNumber`.

## Activity

Every persisted version emits `quote.version.created` in addition to the
triggering mutation event (`quote.created` or `quote.updated`). Consumers
that want a unified audit stream should filter on
`type.startsWith("quote.")` and rely on the pairing to detect edits.

## Future consumers

- **Jobs (Phase 6+)**: converting an `approved` quote into a job should
  reference the exact `QuoteVersion.id` used to seed the job so future
  edits to the quote (if we ever unlock them) can't retroactively rewrite
  billed work.
- **Customer Portal (later phase)**: read-only view uses `listVersions`
  and never mutates.
