// Immutable activity event names for the Communication module.
// Rule: names are frozen once shipped. Add new events; never rename.
// See docs/activity-events.md.
//
// Payload rule: identifiers, enums, counts, and safe reasons ONLY.
// Never message bodies, customer contact details, or credentials.

export const COMMUNICATION_EVENTS = {
  conversationCreated: "communication.conversation.created",
  conversationUpdated: "communication.conversation.updated",
  conversationStatusChanged: "communication.conversation.status.changed",
  conversationLinked: "communication.conversation.linked",
  messageReceived: "communication.message.received",
  messagePrepared: "communication.message.prepared",
  messageApproved: "communication.message.approved",
  messageQueued: "communication.message.queued",
  messageSent: "communication.message.sent",
  messageFailed: "communication.message.failed",
  messageCancelled: "communication.message.cancelled",
  noteAdded: "communication.note.added",
  serviceRequestCreated: "communication.service_request.created",
  serviceRequestUpdated: "communication.service_request.updated",
  serviceRequestQualified: "communication.service_request.qualified",
  serviceRequestConverted: "communication.service_request.converted",
  reviewRequestCreated: "communication.review_request.created",
  reviewRequestUpdated: "communication.review_request.updated",
} as const;

export type CommunicationEventType =
  (typeof COMMUNICATION_EVENTS)[keyof typeof COMMUNICATION_EVENTS];
