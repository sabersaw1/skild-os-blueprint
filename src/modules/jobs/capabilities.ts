// Jobs module capabilities. Registered via the manifest at bootstrap.
// Owner role holds "*" so gating is additive/documentary in Phase 6.

import type { Capability } from "@/core/roles/roles";

export const JOBS_CAPABILITIES: Capability[] = [
  {
    id: "jobs.read",
    description: "View jobs, status history, labor, and notes.",
    ownerModuleId: "jobs",
  },
  {
    id: "jobs.write",
    description: "Create or edit job records (scope, priority, schedule).",
    ownerModuleId: "jobs",
  },
  {
    id: "jobs.status",
    description:
      "Transition a job between draft / scheduled / in_progress / paused / completed / cancelled.",
    ownerModuleId: "jobs",
  },
  {
    id: "jobs.labor.write",
    description: "Log labor entries against a job.",
    ownerModuleId: "jobs",
  },
  {
    id: "jobs.notes.write",
    description: "Add notes to a job.",
    ownerModuleId: "jobs",
  },
  {
    id: "jobs.assign",
    description: "Assign a job to a technician.",
    ownerModuleId: "jobs",
  },
];
