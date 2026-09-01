# Phase 15 — Final Pre-Exit Audit & Production Readiness

**Status:** PASS (with tracked debt)
**Scope:** Full system verification of all 14 phases — core infrastructure,
13 product modules, money handling, authorization, and the Jarvis/Automation
safety boundaries.

---

## 1. Verification performed

| Check | Result |
|---|---|
| Typecheck (`tsgo --noEmit`) | Clean — 0 errors |
| Unit/behavioral suite | **360 / 360 passing** (22 files) |
| Route smoke test (headless browser, 44 routes) | 44/44 render, **0 console errors, 0 page errors** |
| End-to-end write flow (UI) | Customer created → persisted → detail route → activity event recorded |
| Theme/settings persistence | Round-trips through the StorageDriver seam |

---

## 2. Structural inventory

All 13 product modules are registered in `src/core/bootstrap.ts` and expose a
Module Contract v1 manifest: crm, vehicles, knowledge, inspections, quotes,
jobs, parts, finance, communication, marketing, assistant (Jarvis),
automation, intelligence.

Boundary rules verified:

- No module imports another module's concrete repository. Cross-module reads
  go through the Data Registry (`src/core/data/registry.ts`).
- `src/core/integrations/boundaries.test.ts` statically enforces that the
  integration layer imports no module code, no provider SDK, and no raw
  storage.
- Every route is created through `createModuleRoute()` with declared
  `requiredCapabilityIds`.

---

## 3. Findings resolved in this pass

### F-1 (High) — CRM and Vehicles had no mutation authorization boundary

CRM and Vehicles were the last two repositories still relying on UI-side
capability checks. They sit at the **root** of the business data chain
(customer → vehicle → inspection → quote → job → invoice), so an unguarded
write there was the most consequential bypass remaining before agents can
call repositories directly.

Fixed by wrapping both with `withCapabilityEnforcement()`:

- `crm`: `create`/`update`/`addContact`/`upsertTag` → `crm.write`,
  `archive` → `crm.archive`, `addNote` → `crm.notes.write`
- `vehicles`: `create`/`update`/`recordOdometer` → `vehicles.write`,
  `transferOwnership` → `vehicles.transferOwnership`,
  `queuePhoto` → `vehicles.photos.write`

`adjustVehiclesCount` is deliberately left ungated: it is an internal
denormalization callback invoked during vehicle creation, and gating it on a
CRM capability would couple vehicle writes to CRM permissions.

Two failure-path tests were added to `src/core/auth/hardening.test.ts`
proving a read-only actor is denied, **no activity event is emitted**, and no
record is persisted.

### F-2 (Medium) — Two surfaces bypassed the StorageDriver seam

`src/core/auth/provider.ts` and `src/routes/settings.appearance.tsx` still
called `localStorage` directly, which would silently fail in a non-browser
host (test worker, future server bootstrap) and defeat driver substitution.
Both now go through `getStorageDriver()`. `localStorage.` now appears only
inside `browserStorageDriver` itself.

### F-3 (Low) — Duplicate `EvidenceKind` taxonomy

The assistant and intelligence modules each define an `EvidenceKind` union
with divergent literals (`ai_generated` vs `ai_suggestion`). The test that
crossed the boundary was corrected. Unifying the two unions is deferred —
it touches frozen activity payloads.

---

## 4. Safety boundaries re-verified

- **Jarvis is proposal-only.** `jarvis.execute` remains declared, unheld by
  every role, and referenced by no execution path.
- **Outbound communication requires a human.** A message cannot be queued
  without an explicit `communication.approve` action, regardless of what the
  stored record claims.
- **Automation cannot act autonomously** on financial or communication
  surfaces; those actions resolve to `blocked` and stay inert.
- **Persistence never lies.** A failed write raises `PersistenceError`
  *before* `emit()`, so no business event can describe a change that was not
  stored, and in-memory state does not advance.

---

## 5. Remaining technical debt (not blocking)

1. **Finance line items** still type `unitPrice` / `total` as plain `number`
   while documenting integer cents. The values *are* integers everywhere they
   are produced, but the type does not enforce it. Rename to `unitPriceCents`
   with a `v3` envelope migration.
2. **`EvidenceKind` duplication** between assistant and intelligence (F-3).
3. **Activity log is still in-memory** (500-event ring buffer). The
   `ActivityStore` adapter interface exists; no durable adapter is installed.
4. **No scheduler.** Automation runs are triggered by observers only; there
   is no time-based execution surface.
5. **Cross-module integration tests** remain thinner than per-module tests.

---

## 6. Verdict

**PASS.** The system typechecks clean, all 360 tests pass, all 44 routes
render without a single console or page error, and an end-to-end write flow
persists and emits correctly. Every repository mutation now sits behind a
capability boundary, and every storage write goes through one driver seam.
The remaining items are typed-debt and durability work, not correctness or
safety defects.
