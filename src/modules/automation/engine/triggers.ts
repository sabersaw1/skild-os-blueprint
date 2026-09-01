// Trigger abstraction (Phase 13).
//
// WHAT THIS IS
//   A vocabulary, not a scheduler. Phase 13 ships NO polling loop, NO cron,
//   and NO activity-event subscription. A run is started explicitly — from
//   the UI, a command, or a test — and the trigger record explains WHY.
//
// WHY IT EXISTS ANYWAY
//   Every future driver (an event bus subscriber, a local worker, n8n, a
//   scheduled Cloudflare job) can start a run through the same repository
//   call with a different `RunTriggerInfo`. No domain model change is
//   required when a real driver arrives, and no vendor name ever reaches
//   the domain layer.

import type {
  RuleCondition,
  RunTriggerInfo,
  TriggerDefinition,
} from "../data/schemas";

export function manualTrigger(source = "manual:ui"): RunTriggerInfo {
  return { kind: "manual", source };
}

export function observerTrigger(observerId: string): RunTriggerInfo {
  return { kind: "record_state", source: `observer:${observerId}` };
}

export function activityEventTrigger(eventType: string): RunTriggerInfo {
  return { kind: "activity_event", source: `event:${eventType}`, eventType };
}

export function scheduleTrigger(label: string): RunTriggerInfo {
  return { kind: "schedule", source: `schedule:${label}` };
}

/**
 * Is a rule's trigger satisfied by the trigger that started this run?
 *
 * `manual` always matches — a human explicitly asked. Everything else must
 * agree on kind, and on event type / observer id when the rule names one.
 */
export function triggerMatches(
  definition: TriggerDefinition,
  actual: RunTriggerInfo,
): boolean {
  if (actual.kind === "manual") return true;
  if (definition.kind !== actual.kind) return false;
  if (definition.eventType && definition.eventType !== actual.eventType) {
    return false;
  }
  if (
    definition.observerId &&
    actual.source !== `observer:${definition.observerId}`
  ) {
    return false;
  }
  return true;
}

/**
 * Evaluate a rule's conditions against a flat, already-read snapshot of
 * scalar values. Conditions never read a repository themselves — the
 * observer supplies the values, so evaluation stays pure and testable.
 */
export function evaluateConditions(
  conditions: RuleCondition[],
  values: Record<string, unknown>,
  now: number = Date.now(),
): boolean {
  return conditions.every((c) => {
    const actual = values[c.field];
    switch (c.operator) {
      case "exists":
        return actual !== undefined && actual !== null;
      case "eq":
        return actual === c.value;
      case "gte":
        return typeof actual === "number" && actual >= Number(c.value);
      case "lte":
        return typeof actual === "number" && actual <= Number(c.value);
      case "older_than_days":
        return (
          typeof actual === "number" &&
          now - actual >= Number(c.value) * 86_400_000
        );
      default:
        return false;
    }
  });
}
