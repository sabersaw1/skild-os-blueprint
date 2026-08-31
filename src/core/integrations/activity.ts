// Immutable activity event names for the Integration layer.
// Rule: names are frozen once shipped. Add new events; never rename.
// See docs/activity-events.md.
//
// SECURITY: payloads may contain provider ids, connection ids, resource
// types, counts, error codes, and safe messages ONLY. Never credentials,
// tokens, scopes containing secrets, or raw provider payloads.

export const INTEGRATION_EVENTS = {
  connectionCreated: "integration.connection.created",
  connectionUpdated: "integration.connection.updated",
  connectionConnected: "integration.connection.connected",
  connectionDisconnected: "integration.connection.disconnected",
  connectionFailed: "integration.connection.failed",
  connectionRevoked: "integration.connection.revoked",
  syncStarted: "integration.sync.started",
  syncCompleted: "integration.sync.completed",
  syncFailed: "integration.sync.failed",
  externalReferenceSeen: "integration.external_reference.seen",
} as const;

export type IntegrationEventType =
  (typeof INTEGRATION_EVENTS)[keyof typeof INTEGRATION_EVENTS];

export const INTEGRATIONS_MODULE_ID = "integrations";
