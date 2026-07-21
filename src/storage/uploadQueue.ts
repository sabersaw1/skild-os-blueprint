// Upload Queue — Phase 1 skeleton.
// Interfaces + in-memory queue only. No storage provider is wired.
// Later phases attach a StorageProvider and background workers.

import { createStore } from "@/core/store";

export type UploadStatus =
  | "queued"
  | "uploading"
  | "failed"
  | "done";

export type UploadJob = {
  id: string;
  logicalKey: string; // e.g. "inspections/{id}/photos/{uuid}.jpg"
  size: number;
  checksum?: string;
  status: UploadStatus;
  attempts: number;
  lastError?: string;
  enqueuedAt: number;
};

const store = createStore<UploadJob[]>([]);

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function enqueueUpload(
  input: Omit<UploadJob, "id" | "attempts" | "status" | "enqueuedAt">,
): UploadJob {
  const job: UploadJob = {
    id: makeId(),
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
