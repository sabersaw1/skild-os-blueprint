// Immutable activity event names for the Parts module.
// Rule: names are frozen once shipped. Add new events; never rename.
// See docs/activity-events.md.

export const PART_EVENTS = {
  partCreated: "parts.part.created",
  partUpdated: "parts.part.updated",
  partArchived: "parts.part.archived",
  supplierCreated: "parts.supplier.created",
  supplierUpdated: "parts.supplier.updated",
  purchaseCreated: "parts.purchase.created",
  purchaseUpdated: "parts.purchase.updated",
  purchaseReceived: "parts.purchase.received",
  purchaseLineAdded: "parts.purchase_line.added",
  usageRecorded: "parts.usage.recorded",
  vehicleReferenceAdded: "parts.vehicle_reference.added",
} as const;

export type PartEventType = (typeof PART_EVENTS)[keyof typeof PART_EVENTS];
