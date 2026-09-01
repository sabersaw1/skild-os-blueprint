# Referential Integrity Across Modules (Phase 13.5)

Jobs point at Customers, Quotes at Vehicles and Inspections, Jobs at Quotes.
Modules must never import another module's repository, so id verification
runs through the **Data Registry**.

`src/core/data/references.ts`

```ts
await verifyReferences([
  { repository: CRM_CUSTOMER_REPOSITORY, field: "customerId",
    id: input.customerId, entity: "Customer", required: true },
  { repository: VEHICLES_REPOSITORY, field: "vehicleId",
    id: input.vehicleId, entity: "Vehicle" },
  { repository: QUOTES_REPOSITORY, field: "quoteId", id: input.quoteId,
    entity: "Quote",
    lookup: (repo, id) => (repo as QuotesRepository).getQuote(id) },
]);
```

## Rules

1. **Registry only.** The owning module is asked; its concrete implementation
   is never imported.
2. **Unregistered module ⇒ SKIPPED, not failed.** A module may legitimately
   not be bootstrapped (tests, a trimmed deployment, a future server surface).
   Hard-failing would couple every module to every other.
3. **Present-but-missing ⇒ `ReferenceIntegrityError`**, carrying the field
   name so the UI can attribute the error.
4. **Runs before persistence.** Verification is async and sits between
   `validate` and `persist`, keeping the invariant
   `authorize → validate → persist → confirm → emit`.
5. **Custom `lookup`** for repositories that expose `getQuote` /
   `getInspection` rather than a bare `get`.

## Currently enforced

| Writer | Verified references |
|---|---|
| `createQuote` | `customerId` (required), `vehicleId`, `inspectionId` |
| `jobs.create` | `customerId` (required), `vehicleId`, `quoteId` |
