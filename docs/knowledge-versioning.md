# Knowledge Versioning & Migrations

## Versioning rules

1. **Create** writes the document at `versionNumber: 1` and appends
   `KnowledgeVersion` #1 with `changeReason: "Initial version"`.
2. **Update** requires a non-empty `changeReason`, increments
   `versionNumber`, and appends a new `KnowledgeVersion` snapshot.
3. **Archive** flips `status` to `archived`. It does **not** create a new
   version.
4. Versions are immutable. There is no `updateVersion` or
   `deleteVersion` in the repository API.
5. Version history is returned newest-first
   (`listVersions(documentId)`).

## Event ordering

Every mutation follows: **validate → persist document + version →
emit → return**. If persistence fails, no event is emitted.

On update, two events are emitted in this order:

1. `knowledge.document.version.created`
2. `knowledge.document.updated` — OR `knowledge.pricing_rule.updated`
   when the update includes a `pricingRule` payload change.

## Storage envelope

Every stored payload is `{ schemaVersion: <n>, records: <T[]> }`.

The helper `src/modules/knowledge/data/storage.ts` enforces:

- Keys must be registered via `registerVersionedKey({ key, currentVersion, migrations })`
  before any read or write.
- Reads that find a legacy bare-array payload treat it as
  `schemaVersion: 0` and run the migration chain up to the current version.
- Missing migrations throw — this is a bootstrap bug, not a runtime
  fallback.

## Adding a migration

To ship a schema change:

1. Bump `currentVersion` for the key in `local-repository.ts`.
2. Add a `Migration<T>` function under `migrations[currentVersion - 1]`
   that upgrades records from the previous version.
3. Add tests that exercise the migration end to end.
4. Never rename a key. If a shape change is truly incompatible, define a
   new key (`skildos.knowledge.documents.v2`) and migrate on first read.

## Restoration

Restoring an older version is a future concern. The primitives are in
place: read `KnowledgeVersion.content`, call `updateDocument(id, { content },
"restore version N")`. Repository- or UI-level restore helpers can be
added without breaking the contract.
