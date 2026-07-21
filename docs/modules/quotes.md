# Quotes Module

Phase 5 · Local-only · Module Contract v1

The Quotes module owns the customer quote lifecycle. It connects an existing
Customer, Vehicle, and (optionally) Inspection into a versioned, priced
proposal that will later feed the Jobs module.

## Boundaries

- **Owns**: `Quote`, `QuoteVersion`, `LineItem` (embedded), `QuoteStatusChange`
  (embedded), status transitions, totals math.
- **Does not own**: customers, vehicles, inspections, parts inventory,
  finance/payments, jobs. These are referenced by ID only. The module never
  imports another module's repository implementation.
- **External surface**: `QuotesRepository` (registered in the core Data
  Registry under `QUOTES_REPOSITORY`), commands (`quotes.new`,
  `quotes.search`, `quotes.goto`), widget (`quotes.recentQuotes`), routes
  under `/quotes/*`.

## Data flow

```text
Customer ──┐
Vehicle  ──┼─► Quote (draft) ─► send ─► sent ─► approve ─► approved
Inspection ┘                                 └► decline ─► declined
                                             └► expire  ─► expired
```

Every Quote carries an immutable `statusHistory[]` and a monotonically
increasing `currentVersion`. Every edit creates a new `QuoteVersion`
snapshot; the initial create seeds v1 with reason `"Initial version"`.

See [quotes-model.md](../quotes-model.md) for entity fields and
[quotes-versioning.md](../quotes-versioning.md) for the version rules.

## Storage

Repository-only writes, versioned envelope keys:

| Key                             | Entity        |
| ------------------------------- | ------------- |
| `skildos.quotes.quotes.v1`      | `Quote[]`     |
| `skildos.quotes.versions.v1`    | `QuoteVersion[]` |

v0 → v1 pass-through migrations are registered up front so the schema
version bump is safe without changing existing data.

## Capabilities

| Capability       | Grants                                                |
| ---------------- | ----------------------------------------------------- |
| `quotes.read`    | List / view quotes and versions                       |
| `quotes.write`   | Create, edit (draft only), delete drafts              |
| `quotes.version` | Save new versions when editing (paired with `write`)  |
| `quotes.approve` | Approve / decline / expire sent quotes                |

The Owner wildcard grants all four; other roles are opt-in and enforced by
`useHasCapability(...)` in every mutation UI.

## Activity events

Emitted through `@/core/activity/emitter`, immutable names. All events go
under `moduleId: "quotes"`:

- `quote.created`
- `quote.updated`
- `quote.version.created`
- `quote.sent`
- `quote.approved`
- `quote.declined`
- `quote.expired`

Mutation order is always `validate → persist → emit → return`. `create`
and `update` emit two events (mutation + `version.created`) because both
persist a version snapshot.

## Routes

| Path                          | Purpose                              |
| ----------------------------- | ------------------------------------ |
| `/quotes`                     | List + search + status filter        |
| `/quotes/new`                 | Create (customer, vehicle, items)    |
| `/quotes/$quoteId`            | Detail: totals, versions, status     |
| `/quotes/$quoteId/edit`       | Edit draft (requires `changeReason`) |

All routes are declared with `createModuleRoute({ moduleId: "quotes" })`.

## UI capability gating

| Control                         | Capability(ies)              |
| ------------------------------- | ---------------------------- |
| "New quote" button              | `quotes.write`               |
| Line-item editor / save         | `quotes.write`               |
| Save-new-version submit         | `quotes.write` + `quotes.version` |
| Send / Approve / Decline / Expire | `quotes.approve`           |
