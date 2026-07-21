// Upload Queue — Phase 1.5 skeleton.
// Interfaces + in-memory queue only. No storage provider is wired.
// A background worker + StorageProvider land in a later phase.
//
// Every job carries `schemaVersion` so a durable adapter can migrate legacy
// jobs forward without loss.

import { createStore } from "@/core/store";

/**
 * Bump when `UploadJob` gains/loses required fields or changes semantics.
 * Register a migration below.
 */
export const UPLOAD_QUEUE_SCHEMA_VERSION = 1;

export type UploadStatus = "queued" | "uploading" | "failed" | "done";

export type UploadJob = {
  id: string;
  schemaVersion: number;
  logicalKey: string; // e.g. "inspections/{id}/photos/{uuid}.jpg"
  size: number;
  checksum?: string;
  status: UploadStatus;
  attempts: number;
  lastError?: string;
  enqueuedAt: number;
};

export type UploadMigration = {
  fromVersion: number;
  migrate: (job: UploadJob) => UploadJob;
};

const migrations: UploadMigration[] = [];

export function registerUploadMigration(m: UploadMigration) {
  if (migrations.some((x) => x.fromVersion === m.fromVersion)) {
    throw new Error(
      `Upload migration for version ${m.fromVersion} already registered.`,
    );
  }
  migrations.push(m);
  migrations.sort((a, b) => a.fromVersion - b.fromVersion);
}

export function migrateUploadJob(job: UploadJob): UploadJob {
  let current = job;
  while (current.schemaVersion < UPLOAD_QUEUE_SCHEMA_VERSION) {
    const step = migrations.find(
      (m) => m.fromVersion === current.schemaVersion,
    );
    if (!step) {
      throw new Error(
        `No upload migration from schemaVersion ${current.schemaVersion} to ${current.schemaVersion + 1}.`,
      );
    }
    current = {
      ...step.migrate(current),
      schemaVersion: current.schemaVersion + 1,
    };
  }
  return current;
}

const store = createStore<UploadJob[]>([]);

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function enqueueUpload(
  input: Omit<
    UploadJob,
    "id" | "attempts" | "status" | "enqueuedAt" | "schemaVersion"
  >,
): UploadJob {
  const job: UploadJob = {
    id: makeId(),
    schemaVersion: UPLOAD_QUEUE_SCHEMA_VERSION,
    attempts: 0,
    status: "queued",
    enqueuedAt: Date.now(),
    ...input,
  };
  store.set((prev) => [...prev, job]);
  return job;
}

export function useUploadQueue(): UploadJob[] {
  return store.use();
}

export function uploadQueueSize(): number {
  return store.get().length;
}
