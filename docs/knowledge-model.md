# Knowledge Data Model

## Entities

### `KnowledgeDocument`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID v4 | Generated via `newId()`. Immutable. |
| `type` | enum | One of `repair`, `sop`, `pricing_rule`, `business_rule`, `service_standard`, `brand_voice`, `lesson`, `decision`, `troubleshooting`. |
| `title` | string | Required, ≤200 chars. |
| `summary` | string | Optional short description. |
| `content` | string | Freeform (markdown). Required. |
| `tags` | string[] | Lowercased, trimmed. |
| `status` | enum | `draft` / `active` / `archived`. Defaults to `draft`. |
| `versionNumber` | integer | Starts at 1. Incremented on every update. |
| `ownerId` | string? | Optional owner reference (opaque). |
| `pricingRule` | `PricingRulePayload?` | Present iff `type === "pricing_rule"`. |
| `createdAt` / `updatedAt` | epoch ms | |
| `createdBy` | string | Identity id at creation. |

### `KnowledgeVersion` (immutable)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID v4 | |
| `knowledgeDocumentId` | UUID v4 | FK → `KnowledgeDocument.id`. |
| `versionNumber` | integer | Snapshot of the document version this record represents. |
| `content` | string | Snapshot of the document content at that version. |
| `changedBy` | string | Identity id. |
| `changeReason` | string | Required. First version uses `"Initial version"`. |
| `createdAt` | epoch ms | |

Versions are append-only. The repository exposes no `updateVersion` or
`deleteVersion` method.

### `KnowledgeLink`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID v4 | |
| `knowledgeId` | UUID v4 | FK → `KnowledgeDocument.id`. |
| `targetType` | string | Opaque module-defined type (`vehicle.model`, `job.type`, `inspection.template`, …). |
| `targetId` | string | Opaque target id. |
| `createdAt` | epoch ms | |

The Knowledge module does not resolve targets. Consuming modules
translate `(targetType, targetId)` into their own domain objects.

### `PricingRulePayload`

Stored inline on a `KnowledgeDocument` whose `type === "pricing_rule"`.

| Field | Type |
| --- | --- |
| `name` | string |
| `category` | string |
| `baseLabor` | number ≥ 0 |
| `markupPercent` | number ≥ 0 |
| `minimumMargin` | number ≥ 0 |
| `approvalRequired` | boolean |

No pricing execution engine exists in Phase 3 — this is storage only.

## Storage keys

All keys use the `{ schemaVersion, records }` envelope from
`src/modules/knowledge/data/storage.ts`.

- `skildos.knowledge.documents.v1`
- `skildos.knowledge.versions.v1`
- `skildos.knowledge.links.v1`

Every key is registered with a `currentVersion` and a migration table
before the repository reads or writes it. See
`docs/knowledge-versioning.md`.

## ER (ASCII)

```text
KnowledgeDocument 1 ─── * KnowledgeVersion
KnowledgeDocument 1 ─── * KnowledgeLink ─── (opaque) target
```

## Registry key

`KNOWLEDGE_REPOSITORY = "knowledge.repository"` — resolved through
`src/core/data/registry.ts`. Consumers never import the local repository
directly.
