# Repository Authorization & Persistence Semantics (Phase 12.2)

Status: active. Introduced by the pre-agent hardening pass, before Phase 13
(Automation / Agents).

## 1. Why the boundary moved

Through Phase 12 every capability check lived in a route component or in
`useHasCapability()`. That is adequate while a human clicking the UI is the
only caller. It stops being adequate the moment a **non-interactive caller**
exists — an agent, a scheduled command, an integration adapter — because any
of those can resolve a repository through the Data Registry and call a
mutation directly, never passing through React.

The authoritative check therefore sits at the repository:

```text
UI  /  Agent  /  Adapter  /  Command
  ↓
repository authorization boundary   ← src/core/auth/authorize.ts
  ↓
validation
  ↓
persistence  (must succeed)
  ↓
activity event
```

UI-level checks remain, but they are now **advisory** — they hide actions the
actor cannot perform. The repository decides.

## 2. The mechanism

`src/core/auth/authorize.ts`

| Export | Purpose |
| --- | --- |
| `CapabilityDeniedError` | Thrown on denial. Carries `capabilityId` and the operation name. |
| `actorCan(id)` | Does the current actor hold the capability? |
| `requireCapability(id, op?)` | Throw unless the current actor holds it. |
| `withCapabilityEnforcement(impl, map)` | Wrap a repository implementation with a method → capability map. |

Rules:

- **Capability-based only.** A role name never appears in a repository
  (ADR-003). Roles map to capabilities in `src/core/roles/roles.ts`.
- The actor comes from the registered `IdentityProvider`, so swapping in a
  Supabase or server identity later changes nothing here.
- A denial happens **before validation, mutation, persistence, and emission** —
  an unauthorized call can never produce a business event.
- Denials surface as a **rejected promise**, not a synchronous throw, so
  callers only need `await` / `.catch()`.
- Read methods are intentionally ungated at this layer. Read gating stays in
  the UI and in the Jarvis tool layer, which declares a capability per tool.

Applied inside each repository *factory*, not at registration, so the boundary
holds however the implementation is obtained.

### Coverage

| Module | Guarded capabilities |
| --- | --- |
| Finance | `finance.invoice.write`, `finance.invoice.issue`, `finance.payment.record`, `finance.invoice.void` |
| Communication | `communication.write`, `communication.approve`, `communication.send` |
| Marketing | `leads.write`, `marketing.write`, `marketing.approve`, `marketing.publish` |
| Quotes | `quotes.write`, `quotes.approve` |
| Jobs | `jobs.write`, `jobs.status`, `jobs.labor.write`, `jobs.notes.write`, `jobs.assign` |
| Parts | `parts.write`, `parts.purchase.write`, `parts.usage.write`, `parts.suppliers.write` |
| Inspections | `inspections.write`, `inspections.templates.write`, `inspections.photos.write` |
| Knowledge | `knowledge.write` |

CRM and Vehicles remain ungated at the repository (their mutations are not
financially or externally consequential); see "Known debt" below.

## 3. Communication approval is enforced at the repository

`queueMessage()` re-derives the approval requirement from the message **type**
rather than trusting the stored `requiresApproval` flag, so a record persisted
with the flag cleared — by a legacy row, a migration, or a future adapter —
still cannot be queued without an explicit human approval. `approveMessage()`
itself requires `communication.approve`.

Nothing in the OS transmits a message. Queueing is the outer edge.

## 4. Persistence failure must not produce false success

Previously `writeJson` swallowed every storage failure and returned `void`, so
a repository could not tell a durable write from a dropped one — the activity
log could claim "Payment recorded" when nothing was stored.

Now:

- `writeJson(key, value): boolean` — `true` only on a durable write. The
  `system.storage.quotaExceeded` event is still emitted so an operator sees
  *why* the write failed.
- `writeEnvelope(key, records): boolean` — propagates that result.
- `commitRecords(key, next)` (`src/core/storage/persistence.ts`) — returns
  `next` on success, throws `PersistenceError` otherwise. Repositories assign
  the **result** to their in-memory collection, so in-memory state advances
  only on a confirmed write.
- `assertPersisted(key, ok)` — the same guarantee for repositories whose
  persist helper already holds the mutated collection.

Consequences:

- A failed write throws **before** `emit()`. No successful business event is
  ever recorded for a change that was not stored.
- Multi-collection mutations roll back. Issuing an invoice writes the invoice
  and its immutable snapshot; if the snapshot cannot be stored, the invoice is
  restored to `draft` in memory and in storage and the error is rethrown.

## 5. Jarvis stays proposal-only

`jarvis.execute` remains declared and inert: no repository exposes an execute
path for a proposal, and nothing in the OS acts on one. Phase 13 will give an
agent its own identity with a narrow capability set — everything above applies
to it unchanged, with no agent-specific code path.

## 6. Tests

`src/core/auth/hardening.test.ts` covers the failure paths:

- a read-only actor is denied on Finance, Communication, Marketing, Quotes and
  Jobs, emits nothing, and persists nothing
- authorization is checked before validation
- an unapproved outbound message cannot be queued; it can after approval
- a failed storage write throws `PersistenceError`, emits no business event,
  and leaves in-memory state unchanged
- an invoice does not stay `issued` when its snapshot cannot be stored
- `jarvis.execute` is declared but unused

## 7. Known debt

- **Money representation.** Finance and Parts use canonical integer cents.
  Quotes and Jobs still use float dollars. A future pass must migrate Quotes
  and Jobs to integer cents (with a storage-envelope migration) so every money
  value in the OS shares one representation. Not done in this pass by design.
- **CRM / Vehicles authorization.** Ungated at the repository today. Add
  `customers.write` / `vehicles.write` enforcement when a non-UI caller can
  reach them.
- **Rollback scope.** Rollback is best-effort per mutation, not a transaction.
  A real transactional boundary arrives with server-backed storage.
