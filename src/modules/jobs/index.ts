// Public entry point for the Jobs module.
// Consumers import types + the register function from here.

export { registerJobsModule } from "./manifest";
export { JOBS_CAPABILITIES } from "./capabilities";
export { JOB_EVENTS } from "./activity";
export {
  JOBS_REPOSITORY,
  type JobsRepository,
} from "./data/repository";
export {
  JOB_STATUSES,
  JOB_PRIORITIES,
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
} from "./data/schemas";
export {
  useJob,
  useJobs,
  useJobsRepository,
  useJobLabor,
  useJobNotes,
  useJobStatusHistory,
} from "./hooks";
