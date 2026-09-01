# Marketing + Lead Machine (Phase 11)

Owns the **lead domain** and the **marketing opportunity domain**. It is the
foundation the Lead Machine will later operate — it does not operate it yet.

## What it owns

| Entity | Purpose |
| --- | --- |
| `Lead` | One real inquiry, its attribution, lifecycle, and conversion ids |
| `MarketingOpportunity` | An evidence-backed belief that work may be worth doing |
| `MarketingAction` | A recommended, human-approved unit of marketing work |
| `PagePerformanceRecord` | Measured page data ingested from a Phase 9 adapter or a human |
| `SearchOpportunityRecord` | Measured search query data, rule-scored |
| `LocalVisibilityRecord` | Measured local profile data |

Storage keys are versioned envelopes under `skildos.marketing.*.v1`.

## What it does NOT own

Customers, vehicles, conversations, quotes, jobs, invoices. Those stay in
their modules; a Lead only carries **opaque ids** and resolves siblings
through the Data Registry. `getLeadChain()` reconstructs
Lead → Customer → Quote → Job → Invoice from ids alone — nothing is copied,
so nothing can drift.

## Lead lifecycle

```text
new → contacted → qualifying → qualified → quote_prepared → quote_sent
    → considering → scheduled → won
any non-terminal → follow_up | lost      (won / lost are terminal)
```

Transitions outside `LEAD_TRANSITIONS` are rejected. `awaitingParty` is
derived from status, never set by hand.

## Attribution

Every lead stores a **first touch** and a **last touch**
(`source`, `sourceDetail`, `medium`, `campaign`, `landingPage`,
`referralSource`, `integrationId`, `externalRef`). `recordTouch()` updates
last touch only. `integrationId + externalRef` gives inbound adapters
idempotency: replaying the same provider event returns the existing lead.

## Scoring

`data/scoring.ts` is deterministic and rule-based. Every score ships with
`scoreReasons`. There is no model, no guess, and no hidden weighting — a
human can always read why a lead scored what it scored.

## Derived intelligence (computed on read, never stored)

- `listLeadsNeedingAttention()` — never contacted, awaiting us, follow-up
  due/overdue, stale, quote sent with no response.
- `getSourcePerformance()` / `getServicePerformance()` — counts only.
  Invoice amounts stay in Finance.
- `listRetentionOpportunities()` — previous customers with completed work,
  derived from the Jobs repository. No maintenance interval is invented.

## Human control boundary

| Capability | Grants |
| --- | --- |
| `leads.read` / `leads.write` | View / manage leads |
| `marketing.read` / `marketing.write` | View / record opportunities and actions |
| `marketing.approve` | Approve an opportunity or action |
| `marketing.publish` | Mark a public-facing action executed |

Phase 11 sends nothing, publishes nothing, and contacts nobody. Action
status only records what a human did. This split is deliberate: a future
agent can be granted observation and preparation rights while remaining
structurally unable to publish.

## Routes

`/leads`, `/leads/new`, `/leads/$leadId`, `/marketing`,
`/marketing/actions`, `/marketing/performance` — all via `createModuleRoute`
with capability gating.
