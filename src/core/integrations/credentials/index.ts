// Credential architecture.
//
// HARD RULES
//   1. Secret material (OAuth client secrets, refresh/access tokens, API
//      keys, passwords) is NEVER stored in business records, connection
//      records, activity events, logs, or browser-visible state.
//   2. The core only ever holds a `CredentialRef` — an opaque handle.
//   3. There is deliberately NO browser credential vault. Storing secrets
//      in localStorage would be insecure; production secret persistence is
//      DEFERRED until a server-side secret backend exists (see
//      docs/integration-security.md).
//
// The `CredentialResolver` contract below is what a future server-side
// vault implements. The default resolver is a null resolver that reports
// "configuration_missing" for every provider — which is why no live OAuth
// provider can be connected in Phase 9.

import { IntegrationError } from "../errors";
import type { CredentialRef, ProviderId } from "../types";

/** Resolved credentials are opaque to the core; only adapters consume them. */
export interface ResolvedCredential {
  readonly ref: CredentialRef;
  /** Adapter-defined material. Never returned to UI or activity payloads. */
  readonly material: unknown;
}

export interface CredentialResolver {
  readonly backend: string;
  /** True when this backend can hold secrets for the provider. */
  supports(provider: ProviderId): boolean;
  /** Server-side only in real implementations. Throws when unavailable. */
  resolve(ref: CredentialRef): Promise<ResolvedCredential>;
  /** Store secret material and return an opaque reference. */
  store(provider: ProviderId, material: unknown): Promise<CredentialRef>;
  /** Forget the secret behind a reference. */
  revoke(ref: CredentialRef): Promise<void>;
}

/** Default resolver: holds nothing, supports nothing, leaks nothing. */
export function createNullCredentialResolver(): CredentialResolver {
  return {
    backend: "none",
    supports: () => false,
    async resolve() {
      throw new IntegrationError(
        "configuration_missing",
        "No secure credential backend is configured. Live provider " +
          "authorization is deferred until server-side secret storage exists.",
      );
    },
    async store() {
      throw new IntegrationError(
        "configuration_missing",
        "Refusing to store credentials: no secure credential backend is " +
          "configured. Secrets are never written to browser storage.",
      );
    },
    async revoke() {
      /* nothing is held, nothing to revoke */
    },
  };
}

let resolver: CredentialResolver = createNullCredentialResolver();

export function setCredentialResolver(next: CredentialResolver): void {
  resolver = next;
}

export function getCredentialResolver(): CredentialResolver {
  return resolver;
}

/**
 * Build a credential reference. The handle is an opaque, non-secret token
 * derived from ids the OS already knows.
 */
export function makeCredentialRef(
  backend: string,
  handle: string,
): CredentialRef {
  return { backend, handle };
}

const SECRET_HINTS = [
  "token",
  "secret",
  "password",
  "apikey",
  "api_key",
  "refresh",
  "authorization",
  "bearer",
  "client_secret",
];

/**
 * Guard used by the repository and by tests: rejects any object that looks
 * like it carries secret material. Cheap, deterministic, no false comfort —
 * it is a backstop, not a substitute for the rules above.
 */
export function assertNoSecretMaterial(
  value: unknown,
  context: string,
): void {
  const seen = new Set<unknown>();
  const walk = (node: unknown): void => {
    if (node == null || typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      const lowered = key.toLowerCase();
      if (SECRET_HINTS.some((hint) => lowered.includes(hint))) {
        throw new IntegrationError(
          "invalid_request",
          `${context}: field "${key}" looks like secret material and must ` +
            `not be stored or emitted.`,
        );
      }
      walk(child);
    }
  };
  walk(value);
}
