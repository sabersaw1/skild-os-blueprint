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
| `vehicles.ownership.transferred` | `{ vehicleId, fromCustomerId, toCustomerId, reason }` |
| `vehicles.odometer.recorded` | `{ vehicleId, value, unit }` |
| `vehicles.photo.queued` | `{ vehicleId, logicalKey }` |
| `knowledge.document.created` | `{ knowledgeId, type, versionId }` |
| `knowledge.document.updated` | `{ knowledgeId, versionNumber, fields[] }` |
| `knowledge.document.version.created` | `{ knowledgeId, versionId, versionNumber, changeReason }` |
| `knowledge.document.archived` | `{ knowledgeId }` |
| `knowledge.link.created` | `{ knowledgeId, linkId, targetType, targetId }` |
| `knowledge.pricing_rule.updated` | `{ knowledgeId, versionNumber }` |
| `inspection.template.created` | `{ templateId, name }` |
| `inspection.template.updated` | `{ templateId, fields[] }` |
| `inspection.created` | `{ inspectionId, vehicleId, customerId, templateId? }` |
| `inspection.updated` | `{ inspectionId, fields[] }` |
| `inspection.finding.created` | `{ findingId, inspectionId, severity }` |
| `inspection.finding.updated` | `{ findingId, inspectionId, fields[] }` |
| `inspection.photo.queued` | `{ photoId, inspectionId, findingId?, logicalKey }` |
| `quote.created` | `{ quoteId, customerId, vehicleId, inspectionId?, total }` |
| `quote.updated` | `{ quoteId, fields[] }` |
| `quote.version.created` | `{ quoteId, versionId, versionNumber, changeReason }` |
| `quote.sent` | `{ quoteId }` |
| `quote.approved` | `{ quoteId }` |
| `quote.declined` | `{ quoteId }` |
| `quote.expired` | `{ quoteId }` |
| `job.created` | `{ jobId, customerId, vehicleId, quoteId?, inspectionId?, priority }` |
| `job.updated` | `{ jobId, fields[] }` |
| `job.status.changed` | `{ jobId, fromStatus, toStatus, reason? }` |
| `job.labor.added` | `{ jobId, laborId, hours, rate }` |
| `job.note.added` | `{ jobId, noteId }` |
| `job.assigned` | `{ jobId, assignedTo }` |
| `parts.part.created` | `{ partId, name, partNumber? }` |
| `parts.part.updated` | `{ partId, fields[] }` |
| `parts.part.archived` | `{ partId }` |
| `parts.supplier.created` | `{ supplierId, name, type }` |
| `parts.supplier.updated` | `{ supplierId, fields[] }` |
| `parts.purchase.created` | `{ purchaseId, supplierId, total, lineCount }` |
| `parts.purchase.updated` | `{ purchaseId, fields[] }` |
| `parts.purchase.received` | `{ purchaseId, receivedAt }` |
| `parts.purchase_line.added` | `{ purchaseLineId, purchaseId, lineTotal }` |
| `parts.usage.recorded` | `{ partUsageId, partId, vehicleId, jobId?, totalCost }` |
| `parts.vehicle_reference.added` | `{ partVehicleReferenceId, partId, vehicleId }` |
| `finance.invoice.created` | `{ invoiceId, customerId }` |
| `finance.invoice.updated` | `{ invoiceId }` |
| `finance.invoice.issued` | `{ invoiceId, snapshotId, total, note? }` |
| `finance.invoice.voided` | `{ invoiceId, reason }` |
| `finance.payment.recorded` | `{ invoiceId, paymentId, method, balance }` |
| `finance.invoice.partially_paid` | `{ invoiceId, amountPaid, balance }` |
| `finance.invoice.paid` | `{ invoiceId, amountPaid, balance }` |
| `integration.connection.created` | `{ integrationId, provider }` |
| `integration.connection.updated` | `{ integrationId, provider, fields[] }` |
| `integration.connection.connected` | `{ integrationId, provider, accountLabel? }` |
| `integration.connection.disconnected` | `{ integrationId, provider }` |
| `integration.connection.failed` | `{ integrationId, provider, code, message }` |
| `integration.connection.revoked` | `{ integrationId, provider }` |
| `integration.sync.started` | `{ integrationId, provider, resourceType, mode }` |
| `integration.sync.completed` | `{ integrationId, provider, resourceType, recordCount, newReferenceCount }` |
| `integration.sync.failed` | `{ integrationId, provider, resourceType, code, message, retryable }` |
| `integration.external_reference.seen` | `{ integrationId, provider, resourceType, externalId, created }` |

Integration payloads carry provider ids, resource types, counts, error codes,
and safe messages ONLY — never credentials, tokens, or raw provider payloads.





Shell/system events (`shell.navigation.*`, `settings.value.updated`,
`identity.session.started`) remain as defined in Phase 1.

## Consumer guidance

- Modules emit events from repository methods after the write succeeds.
- Consumers subscribe via `activityEmitter.subscribe(listener)`.
- Payloads MUST NOT contain PII beyond identifiers and names already visible
  in-app; secrets and free-text notes stay out of payloads.
