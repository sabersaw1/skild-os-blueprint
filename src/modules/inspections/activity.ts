// Immutable activity event names for the Inspections module.
// Rule: names are frozen once shipped. Add new events; never rename.
// See docs/activity-events.md.

export const INSPECTION_EVENTS = {
  templateCreated: "inspection.template.created",
  templateUpdated: "inspection.template.updated",
  inspectionCreated: "inspection.created",
  inspectionUpdated: "inspection.updated",
  findingCreated: "inspection.finding.created",
  findingUpdated: "inspection.finding.updated",
  photoQueued: "inspection.photo.queued",
} as const;

export type InspectionEventType =
  (typeof INSPECTION_EVENTS)[keyof typeof INSPECTION_EVENTS];
