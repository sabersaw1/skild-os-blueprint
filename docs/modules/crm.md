# CRM Module

Owns customers, contacts, notes, and tags.

## Capabilities

- `crm.read` — list, view, search customers, contacts, notes, tags.
- `crm.write` — create / update / archive customers, contacts, notes, tags.

Alias: `customers.read` / `customers.write` resolve to `crm.read` /
`crm.write` respectively (see `docs/roles-and-permissions.md`).

## Routes

- `/customers` — list, search
- `/customers/new` — create form
- `/customers/:customerId` — detail (vehicles, notes)
- `/customers/:customerId/edit` — edit form

## Data

Interface: `CustomerRepository` (`src/modules/crm/data/repository.ts`).
Local implementation: `src/modules/crm/data/local-repository.ts` — stores
customers, contacts, notes, and tags in versioned `localStorage` under keys
managed by `src/core/storage/local-kv.ts`.

## Cross-module contract

`CustomerRepository.adjustVehiclesCount(customerId, delta)` is the ONLY way
other modules (currently `vehicles`) update a customer's denormalised
`vehiclesCount`. Direct field writes from outside the module are forbidden.

## Events

See `docs/activity-events.md` for the full list. All CRM events use the
`crm.*` namespace.
