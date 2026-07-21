# Vehicles Module

Owns vehicles, ownership history, odometer readings, and queued vehicle
photos.

## Capabilities

- `vehicles.read` — list, view, search vehicles and ownership history.
- `vehicles.write` — create / update vehicles, record odometer, transfer
  ownership, queue photos.

## Routes

- `/vehicles` — list, search (make, model, VIN, plate)
- `/vehicles/new` — create form (accepts `?customerId=` to pre-select owner)
- `/vehicles/:vehicleId` — detail (owner, transfer, ownership history)
- `/vehicles/:vehicleId/edit` — edit form

## Data

Interface: `VehicleRepository` (`src/modules/vehicles/data/repository.ts`).
Local implementation: `src/modules/vehicles/data/local-repository.ts` —
stores vehicles and ownership records in versioned `localStorage`.

## Cross-module contract

- On create / delete: calls
  `CustomerRepository.adjustVehiclesCount(customerId, ±1)` via the data
  registry.
- On ownership transfer: closes the current `OwnershipRecord`, opens a new
  one, and adjusts both customers' counts atomically inside the repository
  method.
- Photo uploads: `queuePhoto` writes only a `logicalKey` reference; actual
  bytes are handed to `uploadQueue` (Phase 1 skeleton). No `Blob` or base64
  ever lands in a repository.

## Events

See `docs/activity-events.md`. All Vehicles events use the `vehicles.*`
namespace.
