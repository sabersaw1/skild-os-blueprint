// Jobs domain types.
// Interfaces + constant unions only. Validation lives in the repository
// (see ./local-repository.ts) — no Zod dependency in Phase 6.

export type JobStatus =
  | "draft"
  | "scheduled"
  | "in_progress"
  | "paused"
  | "completed"
  | "cancelled";

export const JOB_STATUSES: JobStatus[] = [
  "draft",
  "scheduled",
  "in_progress",
  "paused",
  "completed",
  "cancelled",
];

export type JobPriority = "low" | "normal" | "high" | "urgent";

export const JOB_PRIORITIES: JobPriority[] = [
  "low",
  "normal",
  "high",
  "urgent",
];

export interface Job {
  id: string;
  customerId: string;
  vehicleId: string;
  quoteId?: string;
  inspectionId?: string;
  title: string;
  description: string;
  status: JobStatus;
  priority: JobPriority;
  /** ISO string or epoch ms — stored as epoch ms for consistency. */
  scheduledStart?: number;
  scheduledEnd?: number;
  /** Free-form technician id / name — no Users module in Phase 6. */
  assignedTo?: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface JobStatusHistory {
  id: string;
  jobId: string;
  fromStatus: JobStatus;
  toStatus: JobStatus;
  changedBy: string;
  reason?: string;
  createdAt: number;
}

export interface LaborEntry {
  id: string;
  jobId: string;
  description: string;
  /** Hours worked (>= 0). */
  hours: number;
  /** Hourly rate at the time the entry was logged. */
  rate: number;
  createdAt: number;
  createdBy: string;
}

export interface JobNote {
  id: string;
  jobId: string;
  body: string;
  createdAt: number;
  createdBy: string;
}

// ---- Inputs -------------------------------------------------------------

export interface JobCreateInput {
  customerId: string;
  vehicleId: string;
  quoteId?: string;
  inspectionId?: string;
  title: string;
  description?: string;
  priority?: JobPriority;
  scheduledStart?: number;
  scheduledEnd?: number;
  assignedTo?: string;
  notes?: string;
}

export interface JobUpdateInput {
  title?: string;
  description?: string;
  priority?: JobPriority;
  scheduledStart?: number | null;
  scheduledEnd?: number | null;
  notes?: string;
  quoteId?: string | null;
  inspectionId?: string | null;
}

export interface JobStatusInput {
  reason?: string;
}

export interface LaborInput {
  description: string;
  hours: number;
  rate: number;
}

export interface NoteInput {
  body: string;
}

export interface AssignInput {
  /** Pass null / empty to clear the assignment. */
  assignedTo: string | null;
  reason?: string;
}

export interface JobListQuery {
  customerId?: string;
  vehicleId?: string;
  quoteId?: string;
  inspectionId?: string;
  status?: JobStatus;
  priority?: JobPriority;
  assignedTo?: string;
  search?: string;
  limit?: number;
}
