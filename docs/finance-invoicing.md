# Invoicing Lifecycle & the Snapshot Principle

## Statuses

```text
draft ──issue──> issued ──payment──> partially_paid ──payment──> paid
   │                │                      │
   │                └──────void────────────┴──────void────────> void
   └── (edit / delete freely while draft)
```

- **draft** — fully editable. Not a financial record.
- **issued** — sent to the customer. **Immutable.**
- **partially_paid** — at least one payment, balance still outstanding.
- **paid** — balance is zero.
- **void** — cancelled with a recorded reason; balance forced to zero.

## The snapshot principle

Issuing an invoice writes an `InvoiceSnapshot`: a deep-frozen copy of the
invoice exactly as billed, with `issuedAt` and `issuedBy`. From that moment:

- Lines, quantities, prices, discount, tax, and total can never change.
- `updateInvoice()` throws for any non-draft invoice.
- The only permitted changes are payment application (`amountPaid`,
  `balance`, `status`, `paidAt`) and voiding (`voidedAt`, `voidReason`).

**Corrections** are made by voiding the invoice with a reason and issuing a
replacement — never by editing history. This keeps the paper trail
reconstructable from activity events plus snapshots alone.

## Payments

- Only against `issued` or `partially_paid` invoices.
- Amount must be a positive integer-cent value no larger than the balance;
  overpayment is rejected rather than silently creating a credit.
- Recording a payment emits `finance.payment.recorded` plus either
  `finance.invoice.partially_paid` or `finance.invoice.paid`.

## Numbering

Sequential and gapless per device: `INV-0001`, `INV-0002`, … derived from the
highest existing number. When a shared backend lands the sequence moves
server-side; the format stays.

## Money

Every stored amount is an integer number of cents (USD). Dollars exist only at
the UI edge, converted with `toCents()` on input and `formatCents()` on
output. See [parts money doc](./parts-money.md) — Phase 8 promoted those
helpers to `@/core/money` so Parts and Finance share one implementation.
