// Repository authorization boundary (Phase 12.2).
//
// WHY THIS EXISTS
// ---------------
// Until Phase 12.2 every capability check lived in a route component or a
// hook (`useHasCapability`). That is sufficient while a human clicking the
// UI is the only caller, and completely insufficient the moment a
// non-interactive caller exists: an agent, a scheduled job, or an
// integration adapter resolves a repository through the Data Registry and
// calls a mutation directly, never passing through a React component.
//
// The authoritative boundary therefore has to sit at the repository, not
// above it:
//
//   UI / Agent / Adapter / Command
//     → repository authorization boundary   (this file)
//     → validation
//     → persistence
//     → activity event
//
// RULES
//   • Capability-based only. A role name never appears here or in any
//     repository (ADR-003).
//   • The actor is resolved from the registered IdentityProvider, so
//     swapping in a Supabase/server identity later changes nothing here.
//   • A denial throws `CapabilityDeniedError` BEFORE any validation,
//     mutation, persistence, or activity emission — an unauthorized call
//     can never produce a business event.
//   • Read methods are intentionally left ungated at this layer; read
//     gating stays in the UI and in the Jarvis tool layer, which already
//     declares its capability per tool.
//
// Phase 13 compatibility: an agent gets its own Identity with a role that
// holds a narrow capability set. Everything below applies to it unchanged,
// with no agent-specific code path.

import { getIdentity } from "./identity";
import { hasCapability } from "../roles/roles";

export class CapabilityDeniedError extends Error {
  readonly code = "capability_denied";
  constructor(
    readonly capabilityId: string,
    readonly operation?: string,
  ) {
    super(
      operation
        ? `Not authorized: "${operation}" requires the ${capabilityId} capability.`
        : `Not authorized: the ${capabilityId} capability is required.`,
    );
    this.name = "CapabilityDeniedError";
  }
}

/** Does the CURRENT actor (whoever the identity provider reports) hold it? */
export function actorCan(capabilityId: string): boolean {
  return hasCapability(getIdentity().roleId, capabilityId);
}

/** Throw `CapabilityDeniedError` unless the current actor holds it. */
export function requireCapability(
  capabilityId: string,
  operation?: string,
): void {
  if (!actorCan(capabilityId)) {
    throw new CapabilityDeniedError(capabilityId, operation);
  }
}

/**
 * Map of method name → capability id (or ids, all of which are required).
 * Methods absent from the map are passed through unguarded.
 */
export type CapabilityMap<T> = Partial<Record<keyof T, string | string[]>>;

/**
 * Wrap a repository implementation so the listed methods verify the current
 * actor's capabilities before running. Returns an object satisfying the same
 * interface, so the Data Registry, module contracts, and every consumer are
 * unchanged.
 *
 * Applied inside each repository factory (not at registration) so that the
 * boundary holds no matter how the implementation is obtained.
 */
export function withCapabilityEnforcement<T extends object>(
  impl: T,
  map: CapabilityMap<T>,
): T {
  const guarded: Record<string, unknown> = {};

  for (const [name, value] of Object.entries(impl) as Array<
    [string, unknown]
  >) {
    const required = map[name as keyof T];
    if (typeof value !== "function" || required === undefined) {
      guarded[name] = value;
      continue;
    }
    const ids = Array.isArray(required) ? required : [required];
    const fn = value as (...args: unknown[]) => unknown;
    guarded[name] = (...args: unknown[]) => {
      for (const id of ids) requireCapability(id, name);
      return fn.apply(impl, args);
    };
  }

  return guarded as T;
}
