# Finance Data Model

All monetary fields are **integer cents, USD**. Shared helpers live in
`src/core/money/index.ts` (`toCents`, `toDollars`, `formatCents`, `isCents`,
`lineTotalCents`, `assertCents`). Invoice totals math lives in
`src/modules/finance/data/totals.ts`.

## Invoice

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid v4 | |
| `number` | string | `INV-0001`, sequential, assigned at create |
| `customerId` | id | required |
| `vehicleId` / `jobId` / `quoteId` | id? | optional links |
| `status` | `draft \| issued \| partially_paid \| paid \| void` | |
| `currency` | `"USD"` | |
| `lines` | `InvoiceLine[]` | embedded, frozen once issued |
| `subtotal` / `discount` / `tax` / `total` | cents | derived |
| `amountPaid` / `balance` | cents | derived from payments |
| `terms` / `notes` | string? | |
| `issuedAt` / `dueAt` / `paidAt` / `voidedAt` | epoch ms? | |
| `voidReason` | string? | required to void |
| `createdAt` / `updatedAt` / `createdBy` | | |

`total = max(0, subtotal - discount + tax)`; `balance = max(0, total - amountPaid)`.

## InvoiceLine

`id`, `description`, `category` (`labor | part | fee | discount | other`),
`quantity` (may be fractional), `unitPrice` (cents), `lineTotal`
(`round(quantity * unitPrice)`), optional `partId` / `jobId` / `quoteId`.

## InvoiceSnapshot

`id`, `invoiceId`, `number`, `issuedAt`, `issuedBy`, `invoice` — a deep-frozen
copy of the invoice at issue time. The snapshot, not the live row, is the
record of what the customer was billed.

## Payment

`id`, `invoiceId`, `amount` (cents, > 0), `method`
(`cash | card | check | transfer | other`), `reference?`, `note?`, `paidAt`,
`createdAt`, `createdBy`.

## Validation rules (repository-enforced)

- `customerId` required; every referenced id must resolve when the owning
  repository is registered.
- Line description required, `quantity > 0`, `unitPrice` non-negative integer cents.
- `discount` and `tax` non-negative integer cents.
- Payment amount `> 0` and never greater than the outstanding balance.
- Draft-only edits; issued invoices reject every mutation except payments and void.
