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





## Marketing + Lead Machine (Phase 11)

| Event | Payload |
| --- | --- |
| `marketing.lead.created` | `{ leadId, channel, source, status }` |
| `marketing.lead.updated` | `{ leadId, fields }` |
| `marketing.lead.status.changed` | `{ leadId, from, to }` |
| `marketing.lead.contacted` | `{ leadId, at }` |
| `marketing.lead.qualified` | `{ leadId, qualification }` |
| `marketing.lead.converted` | `{ leadId, quoteId?, appointmentId?, jobId?, invoiceId? }` |
| `marketing.lead.lost` | `{ leadId, reason }` |
| `marketing.lead.linked` | `{ leadId, customerId?, vehicleId?, conversationId? }` |
| `marketing.lead.follow_up.scheduled` | `{ leadId, at }` |
| `marketing.lead.attribution.updated` | `{ leadId, source }` |
| `marketing.opportunity.created` | `{ opportunityId, type, evidenceSource, confidence }` |
| `marketing.opportunity.reviewed` | `{ opportunityId }` |
| `marketing.opportunity.approved` | `{ opportunityId }` |
| `marketing.opportunity.dismissed` | `{ opportunityId, reason? }` |
| `marketing.action.created` | `{ actionId, type, publicFacing }` |
| `marketing.action.approved` | `{ actionId, approvedBy? }` |
| `marketing.action.executed` | `{ actionId, publicFacing }` |
| `marketing.action.measured` | `{ actionId }` |
| `marketing.action.rejected` | `{ actionId, reason? }` |
| `marketing.page_performance.recorded` | `{ recordId, page, evidenceSource }` |
| `marketing.search_opportunity.recorded` | `{ recordId, query, opportunityScore }` |
| `marketing.local_visibility.recorded` | `{ recordId, profile, evidenceSource }` |

Marketing payloads carry ids, enums, counts, and rule-derived scores ONLY —
never customer contact details or message content.

## Jarvis / AI Assistant (Phase 12)

| Event | Payload |
| --- | --- |
| `assistant.query.executed` | `{ intent, intentConfidence, factCount, recommendationCount, uncertaintyCount, blockedCount, providerId }` |
| `assistant.recommendation.created` | `{ count, intent }` |
| `assistant.proposal.created` | `{ proposalId, actionType, risk, requiredCapabilityId, targetCount }` |
| `assistant.proposal.approved` | `{ proposalId, actionType, risk, requiredCapabilityId }` |
| `assistant.proposal.rejected` | `{ proposalId, actionType }` |
| `assistant.proposal.expired` | `{ proposalId, actionType }` |
| `assistant.proposal.executed` | `{ proposalId, actionType }` (recorded human action only) |
| `assistant.attention.acknowledged` | `{ attentionId, status }` |
| `assistant.attention.dismissed` | `{ attentionId, status }` |
| `assistant.brief.generated` | `{ sectionCount, attentionCount, omittedCount }` — reserved for an explicitly requested brief; passive rendering emits nothing |

Assistant payloads carry intents, ids, enums, and counts ONLY — never the
question text, answer text, customer details, or model credentials.

## Automation / Agents (Phase 13)

| Event | Payload |
| --- | --- |
| `automation.agent.created` / `.updated` | `{ agentId, status, allowedCapabilityCount }` |
| `automation.agent.enabled` / `.disabled` | `{ agentId, status }` |
| `automation.rule.created` / `.updated` | `{ ruleId, agentId, actionType, approvalPolicy, triggerKind }` |
| `automation.rule.enabled` / `.disabled` | `{ ruleId, agentId, enabled }` |
| `automation.run.started` | `{ runId, agentId, ruleId, correlationId, triggerKind, triggerSource }` |
| `automation.run.succeeded` / `.failed` / `.blocked` / `.awaiting_approval` / `.cancelled` | `{ runId, agentId, correlationId, status, actionCount }` |
| `automation.action.requested` | `{ actionId, runId, correlationId, actionType, policyDecision }` |
| `automation.action.duplicate_suppressed` | `{ actionId, runId, actionType, idempotencyKey }` |
| `automation.action.blocked` | `{ actionId, actionType, policyReason }` |
| `automation.action.approval_requested` | `{ actionId, actionType, requestedCapabilityIds }` |
| `automation.action.approved` / `.rejected` | `{ actionId, actionType, approvalState }` |
| `automation.action.executed` | `{ actionId, actionType, attempt }` — emitted only after the real work succeeded |
| `automation.action.failed` / `.retried` | `{ actionId, actionType, attempt, maxAttempts }` |

Automation payloads carry ids, enums, counts and short reason codes only —
never a rationale body, message text, or customer details. Every action shares
its run's `correlationId`, so a full decision trail is reconstructable from the
activity log alone.

Shell/system events (`shell.navigation.*`, `settings.value.updated`,
`identity.session.started`) remain as defined in Phase 1.

## Intelligence (Phase 14)

```
intelligence.metric.calculated
intelligence.observation.created | .acknowledged | .dismissed | .resolved
intelligence.opportunity.created | .acknowledged | .dismissed
intelligence.recommendation.created | .accepted | .dismissed | .completed
intelligence.optimization.run
```

Payloads carry metric ids, finding ids, enums, counts and metric values only.
A recommendation event records that an action was *proposed* or that a human
accepted it — never that Skild OS carried it out; the intelligence module has
no execute capability. See `docs/modules/intelligence.md`.

## Consumer guidance


- Modules emit events from repository methods after the write succeeds.
- Consumers subscribe via `activityEmitter.subscribe(listener)`.
- Payloads MUST NOT contain PII beyond identifiers and names already visible
  in-app; secrets and free-text notes stay out of payloads.

## Emission guarantee (Phase 12.2)

A business event is emitted ONLY after the change was durably persisted.
Storage writes return a boolean; repositories commit through
`commitRecords()` / `assertPersisted()` and throw `PersistenceError` on
failure, before `emit()`. A dropped write therefore produces
`system.storage.quotaExceeded` and no successful business event.

Likewise, a call denied by the repository authorization boundary throws
`CapabilityDeniedError` before emission — an unauthorized caller can never
write to the activity trail.
