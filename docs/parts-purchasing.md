# Purchasing Workflow

## Flow

```text
Identify part  →  Choose supplier  →  Record purchase (+ lines)
      →  Track status  →  Record usage on vehicle/job  →  Cost visibility
```

1. **Identify** — search the catalog at `/parts`, or create the part.
2. **Supplier** — pick from `/suppliers/parts`. Suppliers are metadata rows.
3. **Purchase** — `/purchases/parts/new` captures supplier, order number,
   shipping, tax, and one or more lines. Lines are written atomically with the
   purchase; the repository derives subtotal and total.
4. **Status** — `ordered → shipped → received`, or `cancelled` / `returned`.
   Changing status on the detail page emits `parts.purchase.updated` and, when
   set to received, `parts.purchase.received`.
5. **Usage** — on the part detail page, record quantity, unit cost, vehicle,
   and optionally a job. This is the link that makes job cost real.
6. **Cost visibility** — the part detail page totals spend per part; the
   `parts.partsCost` widget totals purchased vs used over 30 days.

## Profit readiness (not implemented in Phase 7)

Usage records carry `unitCost` and `totalCost` in cents alongside `jobId`.
A future Finance module computes margin as
`billed − Σ usage.totalCost for the job` with no schema change required.
Phase 7 deliberately ships no pricing, markup, or margin logic.

## Receipts

`purchase.receiptKey` holds a **logical** Upload Queue key only. Phase 7 does
not upload or render files.
