// Immutable activity event names for the Jobs module.
// Rule: names are frozen once shipped. Add new events; never rename.
// See docs/activity-events.md.

export const JOB_EVENTS = {
  created: "job.created",
  updated: "job.updated",
  statusChanged: "job.status.changed",
  laborAdded: "job.labor.added",
  noteAdded: "job.note.added",
  assigned: "job.assigned",
} as const;

export type JobEventType = (typeof JOB_EVENTS)[keyof typeof JOB_EVENTS];
