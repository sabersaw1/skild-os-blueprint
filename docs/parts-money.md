# Money Representation (Parts & Purchasing)

## Rule

Every persisted monetary value in the Parts module is an **integer number of
cents**, currency USD. Floating-point dollars never reach storage.

Helpers live in `src/modules/parts/data/money.ts`:

| Helper | Purpose |
| --- | --- |
| `toCents(dollars)` | Parse UI input (string or number) into integer cents |
| `toDollars(cents)` | Convert back for display maths |
| `formatCents(cents)` | Locale-formatted USD string |
| `isCents(v)` | Type guard: non-negative safe integer |
| `lineTotalCents(qty, unitCost)` | `round(qty * unitCost)` |
| `computePurchaseTotals(lines, shipping, tax)` | Derived subtotal/total |

## Why

`0.1 + 0.2 !== 0.3`. Accumulated cent drift across purchase lines, shipping,
tax, and later margin/profit calculations produces reconciliation errors that
cannot be repaired after the fact. Integers make every total exact and make a
future Finance module a straight read rather than a migration.

## Boundary

Conversion happens exactly twice:

1. **Input** — form values run through `toCents()` before reaching the
   repository.
2. **Output** — stored cents run through `formatCents()` for display.

The repository rejects any non-integer or negative money value.

## Deviation from Phases 5–6

Quotes (Phase 5) and Jobs (Phase 6) store rounded float dollars. That
convention is retained in those modules to avoid a cross-module migration in
Phase 7. Parts is the reference implementation for the integer-cents standard;
Quotes and Jobs should migrate to it when Finance lands.
