# Activity Events

Every state-changing operation in Skild OS emits a domain event through
`activityEmitter` (`src/core/activity/emitter.ts`). Events are the audit
substrate and the future backbone for AI reasoning and automation triggers.

## Naming rule (immutable)

`[module].[entity].[action]`

- `module` — the owning module id, kebab-case (`crm`, `vehicles`, `shell`).
- `entity` — the aggregate root, singular (`customer`, `vehicle`, `note`).
- `action` — past-tense verb (`created`, `updated`, `archived`, `transferred`).

Once an event name ships, it MUST NOT be renamed or repurposed. Add new
events instead. Renaming breaks activity history, audit logs, and any
downstream automation.

## Registered event names

| Event | Payload |
| --- | --- |
| `crm.customer.created` | `{ id, kind, displayName }` |
| `crm.customer.updated` | `{ id, changedFields[] }` |
| `crm.customer.archived` | `{ id }` |
| `crm.note.created` | `{ id, customerId }` |
| `crm.contact.created` | `{ id, customerId }` |
| `crm.tag.upserted` | `{ id, label }` |
| `vehicles.vehicle.created` | `{ id, customerId, make, model }` |
| `vehicles.vehicle.updated` | `{ id, changedFields[] }` |
| `vehicles.vehicle.transferred` | `{ id, fromCustomerId, toCustomerId, reason }` |
| `vehicles.odometer.recorded` | `{ vehicleId, value, unit }` |
| `vehicles.photo.queued` | `{ vehicleId, logicalKey }` |

Shell/system events (`shell.navigation.*`, `settings.value.updated`,
`identity.session.started`) remain as defined in Phase 1.

## Consumer guidance

- Modules emit events from repository methods after the write succeeds.
- Consumers subscribe via `activityEmitter.subscribe(listener)`.
- Payloads MUST NOT contain PII beyond identifiers and names already visible
  in-app; secrets and free-text notes stay out of payloads.
