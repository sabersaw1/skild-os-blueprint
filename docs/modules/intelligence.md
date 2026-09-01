# Business Intelligence + Continuous Optimization (Phase 14)

Module id: `intelligence` · Repository key: `intelligence.repository`

Business Intelligence is the measurement layer of Skild OS. It reads the
records other modules own, computes figures deterministically, and records
findings for a human to review. It **measures and proposes; it never acts.**

## The one rule that governs this module

> A figure is either derived from stored records, or it is declared
> unavailable. Nothing is estimated, extrapolated, or filled in.

Every consequence below follows from that rule:

- A metric with no source data reports `completeness: "unavailable"` and a
  stated limitation — not a zero presented as fact.
- A comparison against a period with no records returns
  `baselineAvailable: false`. A missing baseline is never substituted with
  zero or a plausible trend.
- Profitability excludes labor **cost**, because the OS records a billing
  rate, not a cost rate. This is declared as a limitation on every report
  rather than silently approximated.
- An opportunity without a calculable impact omits `expectedImpactCents`
  entirely instead of guessing a number.

## Domain model

`src/modules/intelligence/data/schemas.ts`

| Type | Purpose | Persisted |
| --- | --- | --- |
| `MetricDefinition` | Frozen catalogue entry: id, unit, version | no (code) |
| `MetricComputation` | One calculation result over a dataset | no |
| `MetricSnapshot` | Append-only measurement history | yes |
| `Observation` | Something the rules noticed, with evidence | yes |
| `IntelligenceOpportunity` | A measurable improvement worth money | yes |
| `Recommendation` | A proposed human action. Never executed here | yes |
| `Evidence` | Kind + statement + `SourceRef[]` behind any claim | embedded |

Read models (computed on demand, never stored): `FunnelReport`,
`ProfitabilityReport`, `ServicePerformanceRow`, `SourcePerformanceRow`,
`ExpectedVsActualRow`, `ComparisonReport`, `AttentionItem`,
`IntelligenceOverview`.

### Evidence

Every `Observation`, `Opportunity` and `Recommendation` carries a non-empty
`Evidence[]`. Creating one without evidence is rejected by the repository.
`EvidenceKind` distinguishes `verified_data`, `system_derived`,
`customer_provided`, `ai_suggestion` and `assumption` — an `ai_suggestion` is
never a business fact on its own.

## Data access

`src/modules/intelligence/data/read-models.ts` builds a period-scoped
`IntelligenceDataset` by reading Leads, Quotes, Jobs, Finance and Parts
**through the Data Registry**. No BI file imports another module's local
repository, and no BI file touches `localStorage` directly. A repository that
is not registered is added to `unavailableModules` and surfaced in the UI and
in Jarvis answers — never silently treated as "zero".

Money is integer cents everywhere, using `src/core/money`.

## Capabilities

`src/modules/intelligence/capabilities.ts`

| Capability | Grants |
| --- | --- |
| `intelligence.read` | View metrics, reports and recorded findings |
| `intelligence.calculate` | Persist metric snapshots |
| `intelligence.recommend` | Record observations, opportunities, proposals |
| `intelligence.acknowledge` | Human accepts / resolves / completes a finding |
| `intelligence.dismiss` | Human rejects a finding, with a reason |

There is deliberately **no `intelligence.execute`**. Acting on a
recommendation goes through the Phase 13 automation boundary plus the owning
module's own capabilities. Enforcement is centralized in
`withCapabilityEnforcement` (`src/core/auth/authorize.ts`), so a denial
happens *before* validation, persistence or any activity event.

## Mutation flow

Every mutation follows the frozen order:

```
authorize → validate → persist → confirm → emit → notify
```

A denied or invalid call persists nothing and emits nothing.

## Activity events

`src/modules/intelligence/activity.ts`. Names are frozen once shipped.

```
intelligence.metric.calculated
intelligence.observation.created | .acknowledged | .dismissed | .resolved
intelligence.opportunity.created | .acknowledged | .dismissed
intelligence.recommendation.created | .accepted | .dismissed | .completed
intelligence.optimization.run
```

Payloads carry ids, enums, counts and metric values only — never customer
contact details or message bodies.

## Optimization engine

`src/modules/intelligence/data/optimization.ts` holds deterministic rules
(follow-up backlog, quote aging, response time, conversion dips, parts cost
anomalies). Running it is idempotent: findings are deduplicated by rule +
period via `dedupeKey`, so re-running updates rather than duplicates.

The engine has no model call and no randomness. The same records always
produce the same findings.

## Routes

| Route | Shows |
| --- | --- |
| `/intelligence` | Headline metrics, period comparison, funnel, profitability, attention |
| `/intelligence/performance` | Per-service and per-source performance |
| `/intelligence/findings` | Observations, opportunities, recommendations; "Run analysis" |
| `/intelligence/metrics` | Append-only snapshot history; "Capture snapshot" |

All are built with `createModuleRoute()` and gated on `intelligence.read`;
the two action buttons additionally require `intelligence.recommend` and
`intelligence.calculate`.

Command Center widget: **Needs attention** (`intelligence.attention`).

## Jarvis integration

Four read-only tools, each requiring `intelligence.read`:
`getBusinessOverview`, `getFunnelReport`, `getProfitabilityReport`,
`getIntelligenceFindings`. Two intents route to them:
`intelligence.overview` and `intelligence.findings`;
`brief.daily` also pulls the overview.

Jarvis can report what was measured and what is proposed. It cannot capture a
snapshot, record a finding, or accept a recommendation — those methods are
not on the tool surface at all. When a capability is missing or a repository
is absent, the resolver records declared uncertainty instead of an answer.

## Agent compatibility

An agent receives its own `Identity` with a narrow role. Because enforcement
is identity-based and centralized, an agent granted `intelligence.read` can
measure, and one granted `intelligence.recommend` can propose — but no
capability in this module can execute anything. Recommendations remain
proposals until a human acts through the owning module.

## Known limitations (stated, not hidden)

- **Labor cost is unknown.** Gross margin is revenue minus parts cost only.
- **Attribution is verbatim.** A lead with no recorded source is `unknown`,
  never reassigned to a plausible channel.
- **No scheduler.** Snapshots and optimization runs are triggered manually.
- Snapshots are local-first, stored under versioned envelopes in
  `localStorage` via the storage driver.

## Tests

- `data/calculations.test.ts` — 16 tests: emptiness, zero-denominator safety,
  period filtering, declared limitations, baseline honesty.
- `data/local-repository.test.ts` — 19 tests: capability denial persists and
  emits nothing, evidence is mandatory, snapshots append, optimization is
  idempotent, no execute path exists.
- `../assistant/tools/intelligence-tools.test.ts` — 12 tests: tool catalogue
  is read-only, capability and availability boundaries, intent routing,
  grounded answers.
