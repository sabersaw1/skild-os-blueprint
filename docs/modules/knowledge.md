# Knowledge Module

The Knowledge System is Skild OS's structured business memory layer:
SOPs, repair knowledge, pricing rules, brand voice, lessons learned,
and troubleshooting guides. It is **not** an AI system. Future AI,
Inspections, Quotes, Jobs, and Automation consume this module as the
first source of truth.

## Location

`src/modules/knowledge/`

```
knowledge/
  manifest.ts           # module registration
  capabilities.ts       # knowledge.* capability catalog
  activity.ts           # immutable event names
  index.ts              # public exports
  data/
    schemas.ts          # types + document type / status unions
    repository.ts       # public KnowledgeRepository interface + DI key
    local-repository.ts # local implementation (envelope + migrations)
    storage.ts          # versioned envelope helper (schemaVersion + records)
    seed.ts             # placeholder for future demo seeds
  hooks.ts              # React hooks (useKnowledgeDocuments, …)
  components/           # DocumentForm, DocumentListItem, VersionHistoryList, LinkList
  widgets/              # RecentDocumentsWidget
```

Routes live under `src/routes/knowledge.*` and use `createModuleRoute()`.

## Capabilities

| Capability | Purpose |
| --- | --- |
| `knowledge.read` | Read documents, versions, and links. |
| `knowledge.write` | Create or edit documents. |
| `knowledge.version` | View or restore version history. |
| `knowledge.approve` | Approve changes flagged `approvalRequired`. |

Owner role holds `*`. Capabilities are checked through the capability
registry — never by role name.

## Routes

| Path | Component | Capability |
| --- | --- | --- |
| `/knowledge` | list + search + type filter | `knowledge.read` |
| `/knowledge/new` | create form | `knowledge.write` |
| `/knowledge/$knowledgeId` | detail: content, metadata, versions, links | `knowledge.read` |
| `/knowledge/$knowledgeId/edit` | edit form — requires `changeReason` | `knowledge.write` |

All routes are registered via `createModuleRoute()` with `moduleId: "knowledge"`.

## Commands

- `knowledge.new` — navigate to `/knowledge/new` (`knowledge.write`).
- `knowledge.goto` — navigate to `/knowledge` (`knowledge.read`).
- `knowledge.search` — navigate to `/knowledge` for search (`knowledge.read`).

## Widgets

- `knowledge.recentDocuments` — 5 most recent documents.

## Events

See `docs/activity-events.md` for the full catalog. Immutable names:

- `knowledge.document.created`
- `knowledge.document.updated`
- `knowledge.document.version.created`
- `knowledge.document.archived`
- `knowledge.link.created`
- `knowledge.pricing_rule.updated`

Mutation ordering (repository contract): **validate → persist → emit → return**.
No event is emitted before persistence succeeds.

## Cross-module boundaries

The Knowledge module does not import from CRM, Vehicles, or any future
module. Relationships are captured through `KnowledgeLink` records with
opaque `targetType` + `targetId` strings (e.g. `"vehicle.model"` +
`"honda.civic"`).

## Future AI usage (informational — not implemented)

When the AI module lands (Phase 5+), it will:

1. Read documents via `KnowledgeRepository.listDocuments` filtered by
   `type`, `tag`, or full-text `search`.
2. Ground responses in the currently-active version (`status: "active"`).
3. Cite `knowledgeDocumentId` + `versionNumber` in reasoning traces.
4. Never write knowledge directly — proposals go through the same
   `knowledge.write` and `knowledge.approve` capabilities as humans.

Embeddings / vector search are **not** built in Phase 3.

## Migration strategy

Storage is envelope-shaped: `{ schemaVersion, records }`. See
`docs/knowledge-versioning.md` for the version-and-migration protocol.
