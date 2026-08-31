// Built-in adapter registrations.
//
// Phase 9 ships:
//   * one STUB adapter ("website") so the architecture is exercised
//     end-to-end and the UI has something real to drive;
//   * DEFERRED adapters for every roadmap provider. They refuse to connect
//     because no secure server-side credential backend exists yet.
//
// No live OAuth is implemented and no provider is faked as connected.

import { registerIntegrationAdapter } from "../registry";
import { createDeferredAdapter, createStubAdapter } from "./stub";

const DEFERRED_REASON =
  "Live authorization is deferred: no secure server-side credential " +
  "backend is configured. Secrets are never stored in the browser.";

export function registerBuiltInAdapters(): void {
  registerIntegrationAdapter(
    createStubAdapter({
      providerId: "website",
      displayName: "SKILD Auto Website (stub)",
      capabilities: {
        syncModes: ["manual", "webhook"],
        readResources: ["lead"],
        writeResources: [],
        requiresUserInteraction: false,
      },
      sampleRecords: [
        {
          externalId: "stub-lead-1",
          resourceType: "lead",
          summary: "Sample website enquiry (stub data, not a real lead)",
          data: { source: "stub", note: "architecture smoke record" },
        },
      ],
    }),
  );

  const deferred: Array<[string, string]> = [
    ["google.gmail", "Gmail"],
    ["google.calendar", "Google Calendar"],
    ["google.business", "Google Business Profile"],
    ["ebay", "eBay"],
    ["amazon", "Amazon"],
    ["autozone", "AutoZone"],
    ["advance_auto", "Advance Auto Parts"],
    ["oreilly", "O'Reilly"],
    ["payment_provider", "Payment Provider"],
  ];

  for (const [providerId, displayName] of deferred) {
    registerIntegrationAdapter(
      createDeferredAdapter({
        providerId,
        displayName,
        reason: DEFERRED_REASON,
      }),
    );
  }
}
