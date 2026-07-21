// Jobs repository — public interface only.
// The concrete local implementation lives in ./local-repository.ts and is
// registered at bootstrap under JOBS_REPOSITORY. Consumers (route
// components, hooks, other modules) import ONLY from this file.

import type {
  AssignInput,
  Job,
  JobCreateInput,
  JobListQuery,
  JobNote,
  JobStatusHistory,
  JobStatusInput,
  JobUpdateInput,
  LaborEntry,
  LaborInput,
  NoteInput,
} from "./schemas";

export const JOBS_REPOSITORY = "jobs.repository";

export interface JobsRepository {
  // Jobs
  list(query?: JobListQuery): Promise<Job[]>;
  get(id: string): Promise<Job | undefined>;
  create(input: JobCreateInput): Promise<Job>;
  update(id: string, patch: JobUpdateInput): Promise<Job>;

  // Status
  changeStatus(
    id: string,
    to: Job["status"],
    input?: JobStatusInput,
  ): Promise<Job>;
  listStatusHistory(jobId: string): Promise<JobStatusHistory[]>;

  // Labor
  addLabor(jobId: string, input: LaborInput): Promise<LaborEntry>;
  listLabor(jobId: string): Promise<LaborEntry[]>;

  // Notes
  addNote(jobId: string, input: NoteInput): Promise<JobNote>;
  listNotes(jobId: string): Promise<JobNote[]>;

  // Assignment
  assign(id: string, input: AssignInput): Promise<Job>;

  /** Subscribe to any change; consumers use this to refresh. */
  subscribe(listener: () => void): () => void;
}
