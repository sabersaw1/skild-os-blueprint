# Finance / Invoicing (Phase 8)

The Finance module owns **invoices, invoice snapshots, and payments**. It is
the trustworthy financial record later systems (reporting, customer portal,
AI) read from.

## Ownership

| Entity | Owner |
| --- | --- |
| `Invoice` | Finance |
| `InvoiceLine` (embedded) | Finance |
| `InvoiceSnapshot` | Finance |
| `Payment` | Finance |

Customers, vehicles, jobs, and quotes are referenced **by id only**. Finance
never imports another module; when a sibling repository is registered in the
Data Registry it validates the reference, otherwise it accepts it (so the
module stays usable standalone and in isolated tests).

## Capabilities

| Capability | Grants |
| --- | --- |
| `finance.read` | View invoices, payments, balances |
| `finance.invoice.write` | Create / edit DRAFT invoices |
| `finance.invoice.issue` | Issue an invoice (freezes it) |
| `finance.invoice.void` | Void an issued invoice with a reason |
| `finance.payment.write` | Record payments |

## Routes

| Route | Purpose |
| --- | --- |
| `/invoices` | List, filter by status / outstanding balance |
| `/invoices/new` | Create a draft |
| `/invoices/$invoiceId` | Detail: lines, totals, status, payments, snapshots |
| `/invoices/$invoiceId/edit` | Draft-only edit |

All routes are declared with `createModuleRoute()` and gated with
`useHasCapability`.

## Storage

Versioned envelopes (`@/core/storage/envelope`), local only:

```
skildos.finance.invoices.v1
skildos.finance.snapshots.v1
skildos.finance.payments.v1
```

## Dashboard widgets

- **Recent invoices** — last five invoices with status and total.
- **Outstanding balance** — total outstanding, overdue, and open count.

## Related docs

- [Finance data model](../finance-model.md)
- [Invoicing lifecycle](../finance-invoicing.md)
- [Activity events registry](../activity-events.md)
