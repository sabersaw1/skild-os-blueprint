// Model provider registry.
//
// A single replaceable slot. Swapping in a hosted or local model later is a
// one-line change at bootstrap (or in a test) — no domain module changes.
// The provider is intentionally NOT stored in the Data Registry: it is not
// a repository and must never be reachable as one.

import { createDeterministicProvider } from "./deterministic";
import type { ModelProvider } from "./types";

let provider: ModelProvider = createDeterministicProvider();

export function getModelProvider(): ModelProvider {
  return provider;
}

export function setModelProvider(next: ModelProvider): void {
  if (!next || typeof next.complete !== "function" || !next.id) {
    throw new Error("setModelProvider: invalid ModelProvider implementation.");
  }
  provider = next;
}

/** Test/bootstrap helper: restore the built-in deterministic provider. */
export function resetModelProvider(): void {
  provider = createDeterministicProvider();
}
