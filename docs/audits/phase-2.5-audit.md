# Phase 2.5 Hardening Audit

**Scope:** Audit only. No feature work. Only documentation touched.
**Result:** **PASS with minor deviations** (documented below; no blockers for Phase 3).

---

## 1. Module Contract Compliance

| Check | Result |
| --- | --- |
| CRM/Vehicles registered via manifest only | ✅ `src/modules/crm/index.ts`, `src/modules/vehicles/index.ts` invoked from `bootstrap.ts` |
| Shell components unmodified except bootstrap | ✅ `src/core/bootstrap.ts` is the only shell edit |
| Nav / commands / settings / capabilities via registries | ✅ All flow through `registerModule()` |
| No hard-coded module assumptions in shell | ✅ Sidebar/CommandBar iterate registries |
| Routes use `createModuleRoute()` | ⚠️ **DEVIATION** — every route under `src/routes/customers.*.tsx` and `src/routes/vehicles.*.tsx` uses raw `createFileRoute(...)`. The helper exists (`src/core/routes/createModuleRoute.tsx`) but was not adopted for Phase 2. Impact: no default error/notFound boundary or `moduleId` tagging on these routes. Non-blocking; recommend a mechanical migration before Phase 3 adds Knowledge routes. |

## 2. Repository Architecture

| Check | Result |
| --- | --- |
| No component storage access | ✅ (see §3) |
| Hooks only touch repository interfaces | ✅ `src/modules/{crm,vehicles}/hooks.ts` resolve via `getRepository()` |
| Repositories isolated | ✅ `local-repository.ts` files only |
| Cross-module calls via data registry | ✅ Vehicles → CRM via `getRepository<CustomerRepository>(CRM_CUSTOMER_REPOSITORY)` |
| No concrete cross-module imports | ⚠️ **MINOR** — `src/modules/vehicles/data/local-repository.ts` and `src/modules/vehicles/components/VehicleForm.tsx` import the `Customer` **type and key constant** from `@/modules/crm/data/repository`. This is the contract file (interface + key), not a concrete impl, so the swap-readiness invariant holds. Recommend extracting shared types to `@/modules/crm/data/repository` remain the single source (already the case) — flagged for awareness only. |
| Provider swap readiness | ✅ `registerRepository` + `subscribeRepository` support runtime swap; validated by `src/core/data/registry.test.ts` |

## 3. Storage Audit

| Check | Result |
| --- | --- |
| `localStorage` restricted to identity / settings / repositories / local-kv | ⚠️ **DEVIATION** — `src/routes/settings.appearance.tsx` reads/writes `localStorage` directly (theme key). Should route through a settings-registry-backed store. Cosmetic; scoped to one preference. |
| No blobs / base64 stored | ✅ Vehicle photos stored as `logicalKey` strings only |
| Photos use logical upload keys | ✅ `queuePhoto` calls `enqueueUpload({ logicalKey, size, checksum })` |
| `schemaVersion` on stored entities | ⚠️ **DEVIATION** — `schemaVersion` is present on the **queues** (`outbox`, `uploadQueue`) but NOT on the persisted Customer/Vehicle/OwnershipRecord records in `local-kv`. Migration path is not documented for CRM/Vehicles entities. Recommend adding an envelope (`{ schemaVersion, data }`) plus migration registry to `local-kv` before Phase 3. |
| Migration paths documented | Partial — queues only |

## 4. Activity System

| Check | Result |
| --- | --- |
| Every mutation emits exactly one event | ✅ `create`, `update`, `recordOdometer`, `transferOwnership`, `queuePhoto` each emit once |
| No missing / duplicate events | ✅ verified by inspection |
| Names follow `[module].[entity].[action]` | ✅ all conform |
| Immutable contract | ⚠️ **FIXED THIS AUDIT** — `docs/activity-events.md` listed `vehicles.vehicle.transferred` but the code has always emitted `vehicles.ownership.transferred`. Per the immutability rule the shipped code name wins; documentation aligned to the code. No behavioural change. |

## 5. Identity and Permissions

| Check | Result |
| --- | --- |
| `IdentityProvider` abstraction used | ✅ `src/core/auth/identity.ts` delegates to provider |
| No component depends on `LocalIdentityProvider` | ✅ only `provider.ts` references it |
| Capability checks, not role names | ✅ `requiredCapabilityIds` throughout manifests; `hasCapability()` in role layer |
| Owner wildcard `"*"` still works | ✅ role table has one Owner with `"*"` |
| Restricted-identity gating | ⚠️ **UNTESTED** — no automated test asserts a non-owner identity is blocked from CRM/Vehicles writes. Runtime code path exists via capability filter, but no regression guard. Recommend adding a repository-level or command-level test in Phase 2.6 or as part of Phase 3 groundwork. |

## 6. Testing

| Suite | Result |
| --- | --- |
| Typecheck (`bunx tsgo --noEmit`) | ✅ clean |
| Unit tests (`bunx vitest run`) | ✅ 2 files / 6 tests pass |
| Component tests | ❌ none authored — deferred, non-blocking |
| Repository tests (CRM/Vehicles) | ❌ none authored — recommend adding before Phase 3 for cross-module ownership flow |
| Provider swap tests | ✅ `src/core/data/registry.test.ts` covers registry swap |
| Activity adapter tests | ❌ none — Phase 1.5 adapter interface untested |

No missing tests were added in this audit (audit-only scope). Recommended additions listed in "Technical Debt".

## 7. Performance Baseline

Not re-captured in this audit (`docs/performance-baselines.md` retains Phase 1.5 numbers). Recommend running a fresh capture once route-safety migration (§1) lands so the baseline reflects the Phase 3 starting point.

## 8. Documentation Review

| Doc | Status |
| --- | --- |
| `docs/modules/crm.md` | ✅ present, accurate |
| `docs/modules/vehicles.md` | ✅ present, accurate |
| `docs/data-registry.md` | ✅ present, accurate |
| `docs/activity-events.md` | ✅ **updated** — corrected `vehicles.vehicle.transferred` → `vehicles.ownership.transferred` |
| `docs/architecture/id-strategy.md` | ✅ present |

---

## Files Changed

- `docs/activity-events.md` — one row corrected to match shipped event name.
- `docs/audits/phase-2.5-audit.md` — this report (new).

## Tests Performed

- `bunx tsgo --noEmit` → clean
- `bunx vitest run` → 6/6 pass

## Deviations Summary

1. Phase 2 routes bypass `createModuleRoute()` — mechanical migration recommended.
2. `settings.appearance.tsx` reads `localStorage` directly — should move to settings registry.
3. Domain entities lack `schemaVersion` envelope in `local-kv` — add before Phase 3 to keep future migrations cheap.
4. Doc/code event-name drift on ownership transfer — resolved by this audit.

## Technical Debt Discovered

- No repository-level tests for CRM/Vehicles (ownership transfer flow especially).
- No capability-denial regression test.
- No activity-adapter test.
- Appearance setting duplicates logic that the settings registry should own.

## Verdict

**Phase 2.5 Audit: PASS.** Deviations are non-blocking and safe to address as a small hardening pass alongside Phase 3 kickoff.

**Stop. Awaiting approval before Phase 3 (Knowledge System v1).**
