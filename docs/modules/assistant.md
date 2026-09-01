# Jarvis — AI Business Assistant (Phase 12)

Jarvis is the reasoning surface over Skild OS. It reads real records, cites
them, states what it does not know, and proposes only. It owns almost no
data of its own.

## What Jarvis owns

| Record | Purpose |
| --- | --- |
| `AiActionProposal` | A suggested action, its reason, its evidence, its risk, and the capability a future executor would need. Never executed by the system. |
| `AttentionAcknowledgement` | A human's decision (acknowledged / dismissed) about a derived attention item. |

Everything else — jobs, leads, quotes, invoices, parts, conversations,
knowledge — is read live through the Data Registry. Jarvis never copies a
business record and never writes one.

## The pipeline

```text
question
  → classifyIntent()            rule-based, 18 intents, no model call
  → resolveContext()            capability-gated read-only tool calls
  → buildAttentionItems()       derived on read, never stored
  → recommendationsFromAttention()
  → ModelProvider.complete()    wording only, sees grounded context alone
  → JarvisAnswer                facts + sources + uncertainty + gaps
```

## Evidence model

Every statement Jarvis makes is a `Fact` carrying an `EvidenceKind`:

| Kind | Meaning |
| --- | --- |
| `verified_fact` | Read directly from a Skild OS record. |
| `customer_provided` | A customer said it; not verified by the shop. |
| `system_derived` | Computed from records (counts, sums, intervals). |
| `ai_generated` | Wording produced by the model provider. |
| `assumption` | Explicitly flagged inference. Rare, always labelled. |

Each fact carries `SourceRef[]` — `{ module, entity, id }` — so any claim can
be traced back to the record it came from.

## Uncertainty is never empty-washed

A capability denial or an unregistered repository removes that slice of the
answer and adds a sentence to `uncertainty` plus an entry in
`blockedByCapabilities`. Jarvis never renders "unknown" as "zero" and never
fills a gap with a guess.

## Capabilities

| Capability | Grants |
| --- | --- |
| `jarvis.read` | Ask questions. Answers are further filtered by the caller's module capabilities. |
| `jarvis.recommend` | Receive recommendations (interpretation, never fact). |
| `jarvis.propose` | Record a proposal for human review. Recording is not executing. |
| `jarvis.execute` | Reserved for Phase 13. **No Phase 12 code path consumes it.** |

A proposal also records `requiredCapabilityId` — the capability a future
executor would need (`communication.send`, `parts.purchase.write`,
`marketing.publish`, …) — as data, not as a code branch.

## Model provider abstraction

`ModelProvider` (`provider/types.ts`) is the only place a model may live. The
default `deterministic` provider composes prose from grounded facts with no
network call. A provider:

- receives the resolved context only — facts, recommendations, knowledge
  citations, uncertainty;
- never receives a repository, a storage handle, or a credential;
- may not introduce a claim that is not already in the context.

Swapping in a hosted model is `setModelProvider(...)` at bootstrap. A hosted
provider must run server-side and read its key from the server environment.

## Attention engine

Attention items are computed on read from timestamps, statuses, and links, so
they cannot drift. The id is deterministic (`att:<category>:<primary id>`),
which is what lets a human's acknowledgement persist against a derived item.

Categories: new lead · stale lead · unanswered communication · quote awaiting
response · job awaiting parts · scheduling conflict · unpaid invoice · review
opportunity · retention opportunity · marketing opportunity.

## Boundaries held

- Nothing sends, publishes, purchases, schedules, or contacts anyone.
- The only execution state a proposal can reach is `executed_by_human`.
- Activity payloads carry intents, counts, ids, and enums — never question
  text, customer details, or credentials.

## Money (Phase 13.5)

`getJobCost` now reports `laborAmountCents` (integer cents), consistent with
`partsCostCents` and `invoicedTotalCents`. Jarvis narration formats it with
`formatCents()`; no float dollars cross the tool boundary.
