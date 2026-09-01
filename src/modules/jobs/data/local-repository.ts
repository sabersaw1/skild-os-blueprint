// Local in-memory + localStorage implementation of JobsRepository.
// Repository implementations are the ONLY place allowed to touch storage.
//
// Storage keys (versioned envelopes — see ./storage.ts):
//   skildos.jobs.jobs.v1
//   skildos.jobs.status-history.v1
//   skildos.jobs.labor.v1
//   skildos.jobs.notes.v1
//
// Mutation ordering rule: validate → persist → emit → return.

import { newId } from "@/core/ids";
import { getIdentity } from "@/core/auth/identity";
import { emit } from "@/core/activity/emitter";
import { JOB_EVENTS } from "../activity";
import {
  JOB_PRIORITIES,
  JOB_STATUSES,
  type AssignInput,
  type Job,
  type JobCreateInput,
  type JobListQuery,
  type JobNote,
  type JobPriority,
  type JobStatus,
  type JobStatusHistory,
  type JobStatusInput,
  type JobUpdateInput,
  type LaborEntry,
  type LaborInput,
  type NoteInput,
} from "./schemas";
import type { JobsRepository } from "./repository";
import {
  readEnvelope,
  registerVersionedKey,
  writeEnvelope,
} from "./storage";
import { assertPersisted } from "@/core/storage/persistence";
import { withCapabilityEnforcement } from "@/core/auth/authorize";

const K_JOBS = "skildos.jobs.jobs.v1";
const K_STATUS = "skildos.jobs.status-history.v1";
const K_LABOR = "skildos.jobs.labor.v1";
const K_NOTES = "skildos.jobs.notes.v1";

// Register versioned keys + migration hooks BEFORE any read/write.
// v0 (legacy bare array) → v1 (envelope). Pass-through migrations reserve
// the hook path for future schema changes.
registerVersionedKey<Job>({
  key: K_JOBS,
  currentVersion: 1,
  migrations: { 0: (records) => records as Job[] },
});
registerVersionedKey<JobStatusHistory>({
  key: K_STATUS,
  currentVersion: 1,
  migrations: { 0: (records) => records as JobStatusHistory[] },
});
registerVersionedKey<LaborEntry>({
  key: K_LABOR,
  currentVersion: 1,
  migrations: { 0: (records) => records as LaborEntry[] },
});
registerVersionedKey<JobNote>({
  key: K_NOTES,
  currentVersion: 1,
  migrations: { 0: (records) => records as JobNote[] },
});

// ---- Validation ---------------------------------------------------------

function validateSchedule(start?: number | null, end?: number | null): void {
  if (start != null && !Number.isFinite(start)) {
    throw new Error("scheduledStart must be a finite epoch-ms number.");
  }
  if (end != null && !Number.isFinite(end)) {
    throw new Error("scheduledEnd must be a finite epoch-ms number.");
  }
  if (start != null && end != null && end < start) {
    throw new Error("scheduledEnd cannot be before scheduledStart.");
  }
}

function validateCreate(input: JobCreateInput): void {
  if (!input.customerId?.trim()) throw new Error("customerId is required.");
  if (!input.vehicleId?.trim()) throw new Error("vehicleId is required.");
  if (!input.title?.trim()) throw new Error("Job title is required.");
  if (input.priority && !JOB_PRIORITIES.includes(input.priority)) {
    throw new Error(`Invalid priority "${input.priority}".`);
  }
  validateSchedule(input.scheduledStart, input.scheduledEnd);
}

function validateUpdate(patch: JobUpdateInput): void {
  if (patch.title !== undefined && !patch.title.trim()) {
    throw new Error("title cannot be empty.");
  }
  if (patch.priority && !JOB_PRIORITIES.includes(patch.priority)) {
    throw new Error(`Invalid priority "${patch.priority}".`);
  }
  validateSchedule(patch.scheduledStart, patch.scheduledEnd);
}

function validateLabor(input: LaborInput): void {
  if (!input.description?.trim()) {
    throw new Error("Labor entry description is required.");
  }
  if (!Number.isFinite(input.hours) || input.hours < 0) {
    throw new Error("Labor hours must be >= 0.");
  }
  if (!Number.isFinite(input.rate) || input.rate < 0) {
    throw new Error("Labor rate must be >= 0.");
  }
}

function validateNote(input: NoteInput): void {
  if (!input.body?.trim()) {
    throw new Error("Note body is required.");
  }
}

// ---- Status transitions -------------------------------------------------

const ALLOWED_STATUS_FLOW: Record<JobStatus, JobStatus[]> = {
  draft: ["scheduled", "cancelled"],
  scheduled: ["in_progress", "cancelled"],
  in_progress: ["paused", "completed", "cancelled"],
  paused: ["in_progress", "cancelled"],
  completed: [],
  cancelled: [],
};

function ensureTransition(from: JobStatus, to: JobStatus): void {
  if (!JOB_STATUSES.includes(to)) {
    throw new Error(`Invalid job status "${to}".`);
  }
  if (from === to) {
    throw new Error(`Job already has status "${to}".`);
  }
  if (!ALLOWED_STATUS_FLOW[from].includes(to)) {
    throw new Error(`Illegal job status transition ${from} → ${to}.`);
  }
}

// ---- Factory ------------------------------------------------------------

export function createLocalJobsRepository(): JobsRepository {
  let jobs: Job[] = readEnvelope<Job>(K_JOBS) ?? [];
  let history: JobStatusHistory[] =
    readEnvelope<JobStatusHistory>(K_STATUS) ?? [];
  let labor: LaborEntry[] = readEnvelope<LaborEntry>(K_LABOR) ?? [];
  let noteRows: JobNote[] = readEnvelope<JobNote>(K_NOTES) ?? [];

  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());
  const persistJobs = () => assertPersisted(K_JOBS, writeEnvelope(K_JOBS, jobs));
  const persistHistory = () => assertPersisted(K_STATUS, writeEnvelope(K_STATUS, history));
  const persistLabor = () => assertPersisted(K_LABOR, writeEnvelope(K_LABOR, labor));
  const persistNotes = () => assertPersisted(K_NOTES, writeEnvelope(K_NOTES, noteRows));
  const find = (id: string) => jobs.find((j) => j.id === id);

  function requireJob(id: string): Job {
    const j = find(id);
    if (!j) throw new Error(`Job ${id} not found.`);
    return j;
  }

  const repo: JobsRepository = {
    async list(query: JobListQuery = {}) {
      let items = jobs.slice();
      if (query.customerId)
        items = items.filter((i) => i.customerId === query.customerId);
      if (query.vehicleId)
        items = items.filter((i) => i.vehicleId === query.vehicleId);
      if (query.quoteId)
        items = items.filter((i) => i.quoteId === query.quoteId);
      if (query.inspectionId)
        items = items.filter((i) => i.inspectionId === query.inspectionId);
      if (query.status)
        items = items.filter((i) => i.status === query.status);
      if (query.priority)
        items = items.filter((i) => i.priority === query.priority);
      if (query.assignedTo)
        items = items.filter((i) => i.assignedTo === query.assignedTo);
      if (query.search) {
        const s = query.search.toLowerCase();
        items = items.filter(
          (i) =>
            i.title.toLowerCase().includes(s) ||
            i.description.toLowerCase().includes(s) ||
            i.notes.toLowerCase().includes(s),
        );
      }
      items.sort((a, b) => b.updatedAt - a.updatedAt);
      return query.limit ? items.slice(0, query.limit) : items;
    },

    async get(id) {
      return find(id);
    },

    async create(input) {
      validateCreate(input);
      const now = Date.now();
      const priority: JobPriority = input.priority ?? "normal";
      const job: Job = {
        id: newId(),
        customerId: input.customerId,
        vehicleId: input.vehicleId,
        quoteId: input.quoteId,
        inspectionId: input.inspectionId,
        title: input.title.trim(),
        description: input.description?.trim() ?? "",
        status: "draft",
        priority,
        scheduledStart: input.scheduledStart,
        scheduledEnd: input.scheduledEnd,
        assignedTo: input.assignedTo?.trim() || undefined,
        notes: input.notes?.trim() ?? "",
        createdAt: now,
        updatedAt: now,
        createdBy: getIdentity().id,
      };
      jobs = [job, ...jobs];
      persistJobs();
      notify();
      emit({
        type: JOB_EVENTS.created,
        moduleId: "jobs",
        summary: `Created job "${job.title}"`,
        payload: {
          jobId: job.id,
          customerId: job.customerId,
          vehicleId: job.vehicleId,
          quoteId: job.quoteId,
          inspectionId: job.inspectionId,
          priority: job.priority,
        },
      });
      return job;
    },

    async update(id, patch) {
      const existing = requireJob(id);
      validateUpdate(patch);
      const next: Job = {
        ...existing,
        title: patch.title?.trim() ?? existing.title,
        description:
          patch.description !== undefined
            ? patch.description.trim()
            : existing.description,
        priority: patch.priority ?? existing.priority,
        scheduledStart:
          patch.scheduledStart === null
            ? undefined
            : patch.scheduledStart !== undefined
              ? patch.scheduledStart
              : existing.scheduledStart,
        scheduledEnd:
          patch.scheduledEnd === null
            ? undefined
            : patch.scheduledEnd !== undefined
              ? patch.scheduledEnd
              : existing.scheduledEnd,
        notes: patch.notes !== undefined ? patch.notes : existing.notes,
        quoteId:
          patch.quoteId === null
            ? undefined
            : patch.quoteId !== undefined
              ? patch.quoteId
              : existing.quoteId,
        inspectionId:
          patch.inspectionId === null
            ? undefined
            : patch.inspectionId !== undefined
              ? patch.inspectionId
              : existing.inspectionId,
        updatedAt: Date.now(),
      };
      // Cross-field validation on the merged record.
      validateSchedule(next.scheduledStart, next.scheduledEnd);
      jobs = jobs.map((j) => (j.id === id ? next : j));
      persistJobs();
      notify();
      emit({
        type: JOB_EVENTS.updated,
        moduleId: "jobs",
        summary: `Updated job "${next.title}"`,
        payload: {
          jobId: id,
          fields: Object.keys(patch),
        },
      });
      return next;
    },

    async changeStatus(id, to, input) {
      const existing = requireJob(id);
      ensureTransition(existing.status, to);
      const now = Date.now();
      const record: JobStatusHistory = {
        id: newId(),
        jobId: id,
        fromStatus: existing.status,
        toStatus: to,
        changedBy: getIdentity().id,
        reason: input?.reason?.trim() || undefined,
        createdAt: now,
      };
      const next: Job = { ...existing, status: to, updatedAt: now };
      jobs = jobs.map((j) => (j.id === id ? next : j));
      history = [...history, record];
      persistJobs();
      persistHistory();
      notify();
      emit({
        type: JOB_EVENTS.statusChanged,
        moduleId: "jobs",
        summary: `Job "${next.title}" → ${to}`,
        payload: {
          jobId: id,
          fromStatus: record.fromStatus,
          toStatus: record.toStatus,
          reason: record.reason,
        },
      });
      return next;
    },

    async listStatusHistory(jobId) {
      return history
        .filter((h) => h.jobId === jobId)
        .slice()
        .sort((a, b) => a.createdAt - b.createdAt);
    },

    async addLabor(jobId, input) {
      requireJob(jobId);
      validateLabor(input);
      const entry: LaborEntry = {
        id: newId(),
        jobId,
        description: input.description.trim(),
        hours: input.hours,
        rate: input.rate,
        createdAt: Date.now(),
        createdBy: getIdentity().id,
      };
      labor = [...labor, entry];
      persistLabor();
      // Touch job.updatedAt so lists resort naturally.
      jobs = jobs.map((j) =>
        j.id === jobId ? { ...j, updatedAt: entry.createdAt } : j,
      );
      persistJobs();
      notify();
      emit({
        type: JOB_EVENTS.laborAdded,
        moduleId: "jobs",
        summary: `Logged ${input.hours}h labor on job ${jobId}`,
        payload: {
          jobId,
          laborId: entry.id,
          hours: entry.hours,
          rate: entry.rate,
          total: entry.hours * entry.rate,
        },
      });
      return entry;
    },

    async listLabor(jobId) {
      return labor
        .filter((l) => l.jobId === jobId)
        .slice()
        .sort((a, b) => a.createdAt - b.createdAt);
    },

    async addNote(jobId, input) {
      requireJob(jobId);
      validateNote(input);
      const note: JobNote = {
        id: newId(),
        jobId,
        body: input.body.trim(),
        createdAt: Date.now(),
        createdBy: getIdentity().id,
      };
      noteRows = [...noteRows, note];
      persistNotes();
      jobs = jobs.map((j) =>
        j.id === jobId ? { ...j, updatedAt: note.createdAt } : j,
      );
      persistJobs();
      notify();
      emit({
        type: JOB_EVENTS.noteAdded,
        moduleId: "jobs",
        summary: `Added note to job ${jobId}`,
        payload: {
          jobId,
          noteId: note.id,
        },
      });
      return note;
    },

    async listNotes(jobId) {
      return noteRows
        .filter((n) => n.jobId === jobId)
        .slice()
        .sort((a, b) => a.createdAt - b.createdAt);
    },

    async assign(id, input: AssignInput) {
      const existing = requireJob(id);
      const raw =
        input.assignedTo === null ? "" : (input.assignedTo ?? "").trim();
      const next: Job = {
        ...existing,
        assignedTo: raw || undefined,
        updatedAt: Date.now(),
      };
      jobs = jobs.map((j) => (j.id === id ? next : j));
      persistJobs();
      notify();
      emit({
        type: JOB_EVENTS.assigned,
        moduleId: "jobs",
        summary: raw
          ? `Assigned job "${next.title}" to ${raw}`
          : `Unassigned job "${next.title}"`,
        payload: {
          jobId: id,
          previousAssignee: existing.assignedTo,
          assignedTo: next.assignedTo,
          reason: input.reason?.trim() || undefined,
        },
      });
      return next;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

    // Authorization boundary — see src/core/auth/authorize.ts. Enforced at the
  // repository so a non-UI caller (agent, adapter, command) cannot bypass it.
  return withCapabilityEnforcement(repo, {
    create: "jobs.write",
    update: "jobs.write",
    changeStatus: "jobs.status",
    addLabor: "jobs.labor.write",
    addNote: "jobs.notes.write",
    assign: "jobs.assign",
  });
}
