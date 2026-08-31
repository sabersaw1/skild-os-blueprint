# Parts & Purchasing (Phase 7)

Module id: `parts`. Owns the parts catalog, suppliers, purchases, purchase
lines, parts usage, and part↔vehicle references.

## Surfaces

| Route | Purpose |
| --- | --- |
| `/parts` | Catalog list with search, brand, category, status filters |
| `/parts/new` | Create a part |
| `/parts/$partId` | Part detail: usage history, cost totals, vehicle fitment, record usage |
| `/parts/$partId/edit` | Edit or archive a part |
| `/purchases/parts` | Purchase list with supplier/status/search filters |
| `/purchases/parts/new` | Record a purchase with lines, shipping, tax |
| `/purchases/parts/$purchaseId` | Purchase detail + status change |
| `/suppliers/parts` | Supplier list and add-supplier form |

Commands: `parts.search`, `parts.new`, `parts.purchase.new`, `parts.purchases`,
`parts.suppliers`, `parts.goto`.
Widgets: `parts.recentPurchases`, `parts.partsCost`.

## Capabilities

- `parts.read` — view all Parts surfaces
- `parts.write` — create/edit/archive catalog parts
- `parts.purchase.write` — record purchases, lines, status changes
- `parts.usage.write` — record parts used on a vehicle or job
- `parts.suppliers.write` — create/edit suppliers

## Boundaries

- Relationships to Vehicles and Jobs are **ID references only**. The module
  never imports another module's repository implementation; vehicle and job
  option lists in the UI come from those modules' published hooks.
- Storage is reachable only from `data/local-repository.ts` through the core
  storage envelope. No component touches `localStorage`.
- Suppliers are metadata records. No API clients, credentials, scraping, or
  external calls exist anywhere in this module. `data/seed.ts` inserts plain
  supplier rows (eBay, Amazon, AutoZone, Advance, O'Reilly) through the
  repository and is idempotent by name.

## Money

Every persisted monetary field is an **integer number of cents (USD)**. See
`docs/parts-money.md`.
