# Parts Data Model

All types live in `src/modules/parts/data/schemas.ts`. All money fields are
integer cents (USD).

## Part

`id, partNumber?, name, description?, manufacturer?, brand?, category?,
status, preferredSupplierId?, createdAt, updatedAt, createdBy`

Status: `active | discontinued | archived`. Archiving is a status change —
records are never deleted.

## Supplier

`id, name, type, website?, accountLabel?, contactName?, contactEmail?,
contactPhone?, notes?, active, createdAt, updatedAt, createdBy`

Type: `marketplace | parts_store | manufacturer | other`. `accountLabel` is a
human label (e.g. "Shop account"); credentials are never stored.

## Purchase

`id, supplierId, orderNumber?, status, purchasedAt?, expectedAt?, receivedAt?,
subtotal, shipping, tax, total, currency, receiptKey?, notes?, createdAt,
updatedAt, createdBy`

Status: `ordered | shipped | received | cancelled | returned`.
`subtotal` = Σ line totals; `total` = subtotal + shipping + tax. Both are
derived by the repository and recomputed whenever lines change — never
supplied by the caller. `receiptKey` is a logical Upload Queue key, never a
URL or blob.

## PurchaseLine

`id, purchaseId, partId?, description, partNumber?, quantity, unitCost,
lineTotal, vehicleId?, jobId?, createdAt`

`lineTotal = round(quantity * unitCost)`.

## PartUsage

`id, partId, vehicleId, jobId?, purchaseLineId?, quantity, unitCost,
totalCost, usedAt, notes?, createdBy`

Usage is the link between the catalog and field work: what part went on which
vehicle, optionally under which job, at what cost.

## PartVehicleReference

`id, partId, vehicleId, notes?, createdAt` — records that a part fits a
vehicle, independent of any purchase or usage.

## Validation rules

- Part name required and non-empty.
- Supplier name required; supplier type must be a known value.
- Purchase requires an existing `supplierId`.
- Usage requires an existing `partId`, a `vehicleId`, and `quantity > 0`.
- Every money input must be a non-negative integer (cents).
