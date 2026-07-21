# Quotes — Data Model

Phase 5 · Local-only

All entities are owned by the Quotes module. Cross-module references
(`customerId`, `vehicleId`, `inspectionId`) are opaque ID strings; the
module never imports another module's repository.

## `Quote`

| Field            | Type                     | Notes                                                                                 |
| ---------------- | ------------------------ | ------------------------------------------------------------------------------------- |
| `id`             | `string` (UUID v4)       | From `@/core/ids`                                                                     |
| `customerId`     | `string`                 | Required                                                                              |
| `vehicleId`      | `string`                 | Required                                                                              |
| `inspectionId?`  | `string`                 | Optional — links a quote to the inspection that generated it                          |
| `title`          | `string`                 | Trimmed, non-empty                                                                    |
| `status`         | `QuoteStatus`            | `draft` \| `sent` \| `approved` \| `declined` \| `expired` (starts at `draft`)        |
| `lineItems`      | `LineItem[]`             | Embedded, see below                                                                   |
| `subtotal`       | `number`                 | Computed by `computeTotals`; rounded to 2 dp                                          |
| `discount`       | `number`                 | ≥ 0, rounded to 2 dp                                                                  |
| `tax`            | `number`                 | ≥ 0, rounded to 2 dp                                                                  |
| `total`          | `number`                 | `subtotal - discount + tax`                                                           |
| `notes`          | `string`                 | Free text                                                                             |
| `statusHistory`  | `QuoteStatusChange[]`    | Append-only audit of status transitions                                               |
| `currentVersion` | `number`                 | Starts at 1; increments once per `updateQuote`                                        |
| `createdAt`      | `number`                 | epoch ms                                                                              |
| `updatedAt`      | `number`                 | epoch ms                                                                              |
| `createdBy`      | `string`                 | Identity id at create time                                                            |

## `LineItem`

| Field          | Type                                   | Notes                                          |
| -------------- | -------------------------------------- | ---------------------------------------------- |
| `id`           | `string`                               | UUID v4                                        |
| `description`  | `string`                               | Trimmed, non-empty                             |
| `category`     | `"labor" \| "part" \| "fee" \| "misc"` | Whitelisted                                    |
| `quantity`     | `number ≥ 0`                           |                                                |
| `unitPrice`    | `number ≥ 0`                           |                                                |
| `laborHours?`  | `number ≥ 0`                           | Present when the item represents billed labor |
| `partReference?` | `string`                             | Free-text external part ID for future Parts   |
| `total`        | `number`                               | `round2(quantity * unitPrice)`                 |

## `QuoteStatusChange`

| Field    | Type          | Notes                          |
| -------- | ------------- | ------------------------------ |
| `from`   | `QuoteStatus` | Previous status                |
| `to`     | `QuoteStatus` | New status                     |
| `at`     | `number`      | epoch ms                       |
| `by`     | `string`      | Identity id                    |
| `reason?`| `string`      | Optional user-supplied note    |

## `QuoteVersion`

| Field           | Type            | Notes                                          |
| --------------- | --------------- | ---------------------------------------------- |
| `id`            | `string`        | UUID v4                                        |
| `quoteId`       | `string`        | Parent quote id                                |
| `versionNumber` | `number`        | Matches `Quote.currentVersion` at snapshot time |
| `snapshot`      | `QuoteSnapshot` | Frozen copy of the quote (no history/versions) |
| `changedBy`     | `string`        | Identity id                                    |
| `changeReason`  | `string`        | Required by `updateQuote`                      |
| `createdAt`     | `number`        | epoch ms                                       |

## Totals math

Pure functions in `src/modules/quotes/data/totals.ts`:

- `lineTotal({ quantity, unitPrice }) = round2(quantity * unitPrice)`
- `computeTotals(items, discount, tax)`:
  - `subtotal = round2(Σ lineTotal(item))`
  - `total = round2(subtotal - discount + tax)`
  - All monetary numbers are clamped `≥ 0` and rounded to 2 dp.

## Status transitions

```text
draft   ── send ──►  sent
sent    ── approve ─► approved
sent    ── decline ─► declined
sent    ── expire  ─► expired
approved / declined / expired  (terminal)
```

Illegal transitions (`draft → approved`, `approved → sent`, etc.) throw.
Editing is only permitted while `status === "draft"`.
