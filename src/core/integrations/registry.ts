// Integration Adapter Registry.
//
// Business modules never instantiate a provider implementation. They resolve
// an adapter by provider id, exactly like repositories resolve through the
// Data Registry. Swapping an adapter (real ↔ stub) is a registration change.

import { createStore } from "../store";
import { IntegrationError } from "./errors";
import type { IntegrationAdapter } from "./adapter";
import type { ProviderId } from "./types";

const adapters = createStore<Record<ProviderId, IntegrationAdapter>>({});

export function registerIntegrationAdapter(adapter: IntegrationAdapter): void {
  adapters.set((prev) => ({ ...prev, [adapter.providerId]: adapter }));
}

export function getIntegrationAdapter(
  providerId: ProviderId,
): IntegrationAdapter {
  const found = adapters.get()[providerId];
  if (!found) {
    throw new IntegrationError(
      "unsupported_operation",
      `No integration adapter registered for provider "${providerId}".`,
      { provider: providerId },
    );
  }
  return found;
}

export function hasIntegrationAdapter(providerId: ProviderId): boolean {
  return Boolean(adapters.get()[providerId]);
}

export function listIntegrationAdapters(): IntegrationAdapter[] {
  return Object.values(adapters.get()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );
}

export function useIntegrationAdapters(): IntegrationAdapter[] {
  return adapters.use((s) =>
    Object.values(s).sort((a, b) => a.displayName.localeCompare(b.displayName)),
  );
}

/** Test-only: remove one adapter, or all when omitted. */
export function clearIntegrationAdapters(providerId?: ProviderId): void {
  if (providerId === undefined) {
    adapters.set({});
    return;
  }
  adapters.set((prev) => {
    const next = { ...prev };
    delete next[providerId];
    return next;
  });
}
