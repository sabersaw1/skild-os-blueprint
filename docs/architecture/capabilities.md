# Capability Catalog

Skild OS checks **capabilities**, never role names (ADR-003). Capabilities are
`<module>.<verb>` and are registered by the owning module's manifest.

## Shell

`shell.navigate` · `commands.run` · `activity.read` · `settings.read` ·
`settings.write`

## Reserved (core/roles/reserved-capabilities.ts)

`knowledge.read` · `knowledge.write` · `knowledge.version` ·
`knowledge.approve` · `ai.read` · `ai.propose` · `ai.approve` ·
`system.admin`

## Modules

| Module | Capabilities |
| --- | --- |
| CRM | `customers.read`, `customers.write` |
| Vehicles | `vehicles.read`, `vehicles.write` |
| Knowledge | `knowledge.read`, `knowledge.write`, `knowledge.version` |
| Inspections | `inspections.*` |
| Quotes | `quotes.*` |
| Jobs | `jobs.*` |
| Parts | `parts.*` |
| Finance | `finance.read`, `finance.invoice.write`, `finance.invoice.issue`, `finance.invoice.void`, `finance.payment.write` |
| Marketing | `leads.read`, `leads.write`, `marketing.read`, `marketing.write`, `marketing.approve`, `marketing.publish` |
| Jarvis (assistant) | `jarvis.read`, `jarvis.recommend`, `jarvis.propose`, `jarvis.execute` (reserved, unused in Phase 12) |
| Automation | `agents.read`, `agents.run`, `agents.approve`, `agents.manage` |
| Integrations | `integrations.read`, `integrations.write`, `integrations.connect`, `integrations.disconnect`, `integrations.sync` |

## Integration capabilities are provider-agnostic

There is no `gmail.connect` or `ebay.sync`. Adding a provider adds an adapter,
never a capability. This keeps the permission surface stable as the provider
roadmap grows, and it is the mechanism by which future agents are granted
scoped authority instead of raw provider credentials.

## Agents hold capabilities, they are not a privileged path

An `Agent` record carries `allowedCapabilityIds`. An agent action whose
required capabilities are not all present is refused, and the action-type
catalogue (`src/modules/automation/data/policy.ts`) refuses externally
consequential work outright. There is no code path by which an agent obtains
authority a human role could not also be given.

## Human approval boundaries

Consequential future actions — customer messaging, public publishing,
purchasing, payments, refunds — each require their own capability and an
approval step before implementation. Phase 11 implements the *boundary*
(`marketing.approve`, `marketing.publish`) but performs no outbound action:
an action's `executed` state only records what a human did.
