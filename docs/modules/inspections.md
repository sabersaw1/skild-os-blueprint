# Inspections module

The Inspections module records vehicle inspections performed by technicians
in the field. It is the first "field operation" module and establishes the
capture pattern (findings + queued photos) that later modules (Quotes, Jobs,
Parts) will consume.

## Scope (Phase 4 — foundation only)

Included:

- `InspectionTemplate` — reusable checklist scaffold. Sections are stored
  but not edited from the UI yet (deferred to a later phase).
- `Inspection` — one performed inspection tied to a vehicle + customer.
- `InspectionFinding` — a discrete observation with severity + status.
- `InspectionPhoto` — a photo reference. Photos are enqueued into the
  shared Upload Queue (`src/storage/uploadQueue.ts`); Phase 4 does NOT
  upload to any storage provider.

Explicitly out of scope for Phase 4 (per the authorization brief): quotes,
jobs, parts, finance, AI, automation, customer portal, Supabase, external
APIs, payments, and messaging.

## Data flow

`Customer → Vehicle → Inspection → Finding → Photo (queued)`

All mutations are routed through `InspectionsRepository`:

1. Validate input.
2. Persist through the repository (versioned envelope storage).
3. Emit one primary activity event.
4. Return the result.

Photos additionally hand off to `enqueueUpload()` before the
`inspection.photo.queued` event fires.

## Storage keys

Versioned envelopes (`src/core/storage/envelope.ts`):

- `skildos.inspections.templates.v1`
- `skildos.inspections.inspections.v1`
- `skildos.inspections.findings.v1`
- `skildos.inspections.photos.v1`

Only `LocalInspectionsRepository` touches these keys.

## Capabilities

- `inspections.read`
- `inspections.write`
- `inspections.templates.write`
- `inspections.photos.write`

Owner role holds `*` and therefore all four.

## Activity events

See `docs/activity-events.md`. The module id is `inspections` (plural),
but the immutable event names use the entity prefix `inspection.` (singular)
as required by the Phase 4 authorization brief.

## Routes

- `/inspections` — list
- `/inspections/new` — create
- `/inspections/$inspectionId` — detail (findings + photo queue)
- `/inspections/$inspectionId/edit` — edit status / notes / template
- `/templates/inspections` — template list
- `/templates/inspections/new` — create template

All routes are declared via `createModuleRoute()`.
