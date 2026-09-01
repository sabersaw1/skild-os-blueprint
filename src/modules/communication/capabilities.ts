// Communication module capabilities. Registered via the manifest at bootstrap.
//
// Capability-based only — never role names (ADR-003). The split between
// `write` and `send`/`approve` is the durable human-control boundary that a
// future AI agent will be granted (or denied) piecemeal.

import type { Capability } from "@/core/roles/roles";

export const COMMUNICATION_CAPABILITIES: Capability[] = [
  {
    id: "communication.read",
    description: "View conversations, messages, and intake requests.",
    ownerModuleId: "communication",
  },
  {
    id: "communication.write",
    description:
      "Create conversations, record inbound messages, draft outbound messages, and capture intake.",
    ownerModuleId: "communication",
  },
  {
    id: "communication.send",
    description:
      "Release an approved outbound message for transmission by an integration adapter.",
    ownerModuleId: "communication",
  },
  {
    id: "communication.approve",
    description:
      "Approve outbound communication that is flagged as requiring human review.",
    ownerModuleId: "communication",
  },
];

/**
 * Message types that ALWAYS require a human approval before send, regardless
 * of who (or what) prepared them. Routine operational notices are excluded;
 * anything that makes a commitment, discusses money, or is free-form is in.
 *
 * Automation may extend this list; it may never shrink it silently.
 */
export const APPROVAL_REQUIRED_MESSAGE_TYPES = [
  "general",
  "quote_notification",
  "invoice_notification",
  "follow_up",
] as const;
