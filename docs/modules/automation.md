# Automation & Agents (Phase 13)

The automation module is the first part of Skild OS that can *act on its own*.
Everything in it is therefore built around a single question: **what is an
agent allowed to do without a human in the room?**

The answer in v1 is deliberately small. An agent may notice things and write
internal notes. It may not talk to a customer, move money, publish anything,
or delete a record — not because those features are unfinished, but because
they are refused by policy.

## 1. The domain

| Record | Meaning |
| --- | --- |
| `Agent` | A named worker with a purpose and an explicit `allowedCapabilityIds` list. |
| `AutomationRule` | A trigger + conditions + the single action type it may propose. |
| `AgentRun` | One pass of the pipeline. Carries a `correlationId`. |
| `AgentAction` | One proposed unit of work, with its policy verdict recorded on it. |
| `Approval` | The human decision attached to an action that required one. |

An agent holds capabilities the same way a person does (ADR-003). It is not a
privileged code path: `withCapabilityEnforcement` gates the automation
repository exactly as it gates Finance or Communication.

## 2. The execution model

```text
OBSERVE     read-only observers scan records for a defined state
UNDERSTAND  conditions are evaluated against the observed values
PROPOSE     an AgentAction is requested, with a written rationale
AUTHORIZE   policy decides: auto_execute | approval_required | blocked
EXECUTE     a handler performs the work through public module interfaces
VERIFY      the handler's real result is recorded — success or failure
RECORD      an immutable activity event is emitted for every transition
```

A run never skips a stage, and AUTHORIZE always happens before anything is
mutated.

## 3. The approval boundary

`src/modules/automation/data/policy.ts` holds the catalogue. It is the single
source of truth; a rule may only make a verdict **stricter**.

| Verdict | Action types in v1 |
| --- | --- |
| `auto_execute` | `attention.flag`, `proposal.create`, `briefing.compile` |
| `approval_required` | `followup.prepare` |
| `blocked` | `communication.send`, `pricing.change`, `finance.invoice.issue`, `finance.payment.record`, `finance.refund`, `marketing.publish`, `record.delete` |

Three rules make this hard to erode:

- An **unknown** action type is blocked. The default is refusal, not permission.
- A rule proposing a blocked action **cannot be enabled** — it is stored inert
  rather than allowed to look live and fail later.
- An action whose required capabilities the agent was not granted is
  downgraded to `blocked`, whatever the catalogue says.

Nothing in this module sends a message. `followup.prepare` *prepares* a
follow-up for review; queueing it still goes through the Communication
module's own approval gate.

## 4. Idempotency and failure

Every action carries an `idempotencyKey` derived from rule + agent + action
type + subject + a time window. Re-running a rule inside that window returns
the **existing** action instead of creating a second one, and emits
`automation.action.duplicate_suppressed`.

Failure is a recorded state, never a silent one. If a handler throws, the
action moves to `failed` with an `errorMessage` and no `resultSummary` — an
agent can never claim work it did not do. Retries increment `attempt` up to
the rule's `maxAttempts`.

## 5. Observability

Every run and action emits an immutable event (see
[activity events](../activity-events.md), `automation.*`). Actions share their
run's `correlationId`, so a single question — "why did this happen?" — is
answerable from the activity log alone: trigger, rationale, verdict, approver,
result.

Jarvis reads this state through three read-only tools
(`getAutomationOverview`, `getRecentAgentRuns`, `getActionsAwaitingApproval`)
and answers the `automation.status` intent with grounded facts. Jarvis still
cannot execute anything.

## 6. Surfaces

- `/automation` — agents and their rules
- `/automation/runs` — run history with outcomes
- `/automation/approvals` — the human decision queue
- Command Center widget: active agents, pending approvals, failed runs

## 7. Known limits

- Triggers are evaluated when something asks them to (manual run, observer
  sweep, activity event). There is no scheduler yet.
- Observers are read-only and local; a server-side worker arrives with
  server-backed storage.
- `jarvis.execute` remains declared and unused.

## Manual trigger behaviour (Phase 13.5)

`triggerMatches(definition, actual)` returns `true` for ANY rule when the
actual trigger kind is `manual`. A human pressing "Run now" is an explicit
authorization event, so the trigger predicate is bypassed on purpose.

What the manual path does **not** bypass:

- capability enforcement (`agents.run`, and the capability of each action),
- the approval policy (`AUTO_EXECUTE` / `APPROVAL_REQUIRED` / `BLOCKED`),
- idempotency (the same correlation key still de-duplicates),
- the action cap (`maxActions`).

Non-manual triggers must agree on `kind`, plus `eventType` / `observerId`
when the rule names one. Covered by
`src/modules/automation/data/local-repository.test.ts`
("triggerMatches — manual bypass").
