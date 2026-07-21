# ADR-005: Freeze Module Contract v1

**Status:** Accepted (Phase 1.5)
**Supersedes:** none
**Superseded by:** none

## Context

Phase 1 shipped a Module Boundary Contract (`ModuleManifest`, `NavEntry`,
`Command`, `SettingsSection`, `DashboardWidget`, capability registration).
Phase 2+ will add many business modules that all consume this contract. Any
churn in the contract shape after modules exist would ripple through every
module simultaneously.

## Decision

The Module Contract as it exists at the end of Phase 1.5 is **frozen as v1**.
The frozen surface is:

- `ModuleManifest` (id, label, description, capabilities, navEntries,
  commands, settingsSections, dashboardWidgets)
- `NavEntry` (id, label, route, icon, order, requiredCapabilityIds)
- `Command` (id, label, group, keywords, requiredCapabilityIds, visible?, run)
- `SettingsSection` (id, moduleId, label, route, order, requiredCapabilityIds,
  schema?, defaultValue?)
- `DashboardWidget` (id, moduleId, title, component, span, order,
  requiredCapabilityIds)
- `Capability` (id, description, ownerModuleId)

### Rules

1. **Additive-only changes** to v1 are allowed and must remain optional
   fields with safe defaults.
2. **Any breaking change** (renaming a field, changing a type, removing a
   field, or changing semantics) requires:
   - A new ADR (ADR-00X) that declares Module Contract v2.
   - A migration guide covering every registered module.
   - A shim that keeps v1 modules functional for at least one phase.
3. Frozen contracts are enforced by review, not code. Reviewers must reject
   PRs that mutate v1 shapes without ADR-authored justification.

## Consequences

- Business modules can be authored against a stable API from day one.
- The shell team is prevented from making unilateral contract changes.
- Some evolution flexibility is traded for module-author certainty. Accepted.
