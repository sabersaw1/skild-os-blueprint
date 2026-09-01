// Unit + integration tests for the Jobs local repository.
// Mirrors the Quotes / Inspections test setup: minimal in-memory
// localStorage polyfill installed before importing the repository module.

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- Minimal localStorage polyfill for node env ------------------------
class MemoryStorage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  key(i: number) {
    return Array.from(this.store.keys())[i] ?? null;
  }
  getItem(k: string) {
    return this.store.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.store.set(k, String(v));
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).window = globalThis;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).localStorage = new MemoryStorage();

// Now import modules under test (after the polyfill).
import { createLocalJobsRepository } from "./local-repository";
import { JOB_EVENTS } from "../activity";
import * as emitter from "@/core/activity/emitter";
import type { JobsRepository } from "./repository";
import {
  clearRepository,
  getRepository,
  registerRepository,
} from "@/core/data/registry";
import { JOBS_REPOSITORY } from "./repository";

function fresh(): JobsRepository {
  (
    globalThis as unknown as { localStorage: MemoryStorage }
  ).localStorage.clear();
  return createLocalJobsRepository();
}

const baseInput = {
  customerId: "cust-1",
  vehicleId: "veh-1",
  title: "Front brake replacement",
};

describe("JobsRepository — CRUD", () => {
  it("creates a job with default draft status, normal priority, and emits job.created", async () => {
    const spy = vi.spyOn(emitter, "emit");
    const repo = fresh();
    spy.mockClear();
    const j = await repo.create({
      ...baseInput,
      description: "Replace pads and rotors",
    });
    expect(j.status).toBe("draft");
    expect(j.priority).toBe("normal");
    expect(j.description).toBe("Replace pads and rotors");
    expect(j.notes).toBe("");

    const types = spy.mock.calls.map(
      (c: unknown[]) => (c[0] as { type: string }).type,
    );
    expect(types).toEqual([JOB_EVENTS.created]);
  });

  it("rejects missing customerId / vehicleId / title", async () => {
    const repo = fresh();
    await expect(
      repo.create({ ...baseInput, customerId: "" }),
    ).rejects.toThrow(/customerId/);
    await expect(
      repo.create({ ...baseInput, vehicleId: "" }),
    ).rejects.toThrow(/vehicleId/);
    await expect(repo.create({ ...baseInput, title: "" })).rejects.toThrow(
      /title/i,
    );
  });

  it("rejects invalid priority and inverted schedule", async () => {
    const repo = fresh();
    await expect(
      // @ts-expect-error deliberate invalid priority
      repo.create({ ...baseInput, priority: "bogus" }),
    ).rejects.toThrow(/priority/);
    await expect(
      repo.create({
        ...baseInput,
        scheduledStart: 2_000,
        scheduledEnd: 1_000,
      }),
    ).rejects.toThrow(/scheduledEnd/);
  });

  it("update applies partial patches, validates, and emits job.updated", async () => {
    const spy = vi.spyOn(emitter, "emit");
    const repo = fresh();
    const j = await repo.create(baseInput);
    spy.mockClear();
    const updated = await repo.update(j.id, {
      title: "Rear brake overhaul",
      priority: "high",
      description: "Rear pads + rotors",
    });
    expect(updated.title).toBe("Rear brake overhaul");
    expect(updated.priority).toBe("high");
    expect(updated.description).toBe("Rear pads + rotors");

    const types = spy.mock.calls.map(
      (c: unknown[]) => (c[0] as { type: string }).type,
    );
    expect(types).toEqual([JOB_EVENTS.updated]);
  });
});

describe("JobsRepository — status transitions", () => {
  it("walks draft → scheduled → in_progress → paused → in_progress → completed and appends history", async () => {
    const spy = vi.spyOn(emitter, "emit");
    const repo = fresh();
    const j = await repo.create(baseInput);
    spy.mockClear();

    await repo.changeStatus(j.id, "scheduled");
    await repo.changeStatus(j.id, "in_progress");
    await repo.changeStatus(j.id, "paused", { reason: "waiting on parts" });
    await repo.changeStatus(j.id, "in_progress");
    const finished = await repo.changeStatus(j.id, "completed");
    expect(finished.status).toBe("completed");

    const history = await repo.listStatusHistory(j.id);
    expect(history.map((h) => `${h.fromStatus}→${h.toStatus}`)).toEqual([
      "draft→scheduled",
      "scheduled→in_progress",
      "in_progress→paused",
      "paused→in_progress",
      "in_progress→completed",
    ]);
    expect(history[2].reason).toBe("waiting on parts");

    const types = spy.mock.calls.map(
      (c: unknown[]) => (c[0] as { type: string }).type,
    );
    expect(types).toEqual([
      JOB_EVENTS.statusChanged,
      JOB_EVENTS.statusChanged,
      JOB_EVENTS.statusChanged,
      JOB_EVENTS.statusChanged,
      JOB_EVENTS.statusChanged,
    ]);
  });

  it("rejects illegal transitions and self-transitions", async () => {
    const repo = fresh();
    const j = await repo.create(baseInput);
    // draft → in_progress is illegal (must schedule first)
    await expect(
      repo.changeStatus(j.id, "in_progress"),
    ).rejects.toThrow(/transition/);
    await expect(repo.changeStatus(j.id, "completed")).rejects.toThrow(
      /transition/,
    );
    // self-transition
    await expect(repo.changeStatus(j.id, "draft")).rejects.toThrow(
      /already/i,
    );
  });

  it("completed and cancelled are terminal", async () => {
    const repo = fresh();
    const a = await repo.create({ ...baseInput, title: "a" });
    await repo.changeStatus(a.id, "cancelled");
    await expect(repo.changeStatus(a.id, "scheduled")).rejects.toThrow(
      /transition/,
    );

    const b = await repo.create({ ...baseInput, title: "b" });
    await repo.changeStatus(b.id, "scheduled");
    await repo.changeStatus(b.id, "in_progress");
    await repo.changeStatus(b.id, "completed");
    await expect(repo.changeStatus(b.id, "in_progress")).rejects.toThrow(
      /transition/,
    );
  });
});

describe("JobsRepository — labor", () => {
  it("adds labor and reports totals via list", async () => {
    const spy = vi.spyOn(emitter, "emit");
    const repo = fresh();
    const j = await repo.create(baseInput);
    spy.mockClear();
    await repo.addLabor(j.id, {
      description: "Diagnostic",
      hours: 0.5,
      rateCents: 12000,
    });
    await repo.addLabor(j.id, {
      description: "Install pads",
      hours: 1.5,
      rateCents: 12000,
    });
    const entries = await repo.listLabor(j.id);
    expect(entries).toHaveLength(2);
    const totalCents = entries.reduce(
      (s, e) => s + Math.round(e.hours * e.rateCents),
      0,
    );
    expect(totalCents).toBe(Math.round(0.5 * 12000) + Math.round(1.5 * 12000));

    const types = spy.mock.calls.map(
      (c: unknown[]) => (c[0] as { type: string }).type,
    );
    expect(types).toEqual([JOB_EVENTS.laborAdded, JOB_EVENTS.laborAdded]);
  });

  it("rejects invalid labor input", async () => {
    const repo = fresh();
    const j = await repo.create(baseInput);
    await expect(
      repo.addLabor(j.id, { description: "", hours: 1, rateCents: 10000 }),
    ).rejects.toThrow(/description/);
    await expect(
      repo.addLabor(j.id, { description: "x", hours: -1, rateCents: 10000 }),
    ).rejects.toThrow(/hours/);
    await expect(
      repo.addLabor(j.id, { description: "x", hours: 1, rateCents: -1 }),
    ).rejects.toThrow(/rateCents/);
    await expect(
      repo.addLabor("nope", { description: "x", hours: 1, rateCents: 1 }),
    ).rejects.toThrow(/not found/);
  });
});

describe("JobsRepository — notes", () => {
  it("adds notes and emits job.note.added", async () => {
    const spy = vi.spyOn(emitter, "emit");
    const repo = fresh();
    const j = await repo.create(baseInput);
    spy.mockClear();
    await repo.addNote(j.id, { body: "Customer called about ETA" });
    const notes = await repo.listNotes(j.id);
    expect(notes).toHaveLength(1);
    expect(notes[0].body).toBe("Customer called about ETA");

    const types = spy.mock.calls.map(
      (c: unknown[]) => (c[0] as { type: string }).type,
    );
    expect(types).toEqual([JOB_EVENTS.noteAdded]);
  });

  it("rejects empty note bodies", async () => {
    const repo = fresh();
    const j = await repo.create(baseInput);
    await expect(repo.addNote(j.id, { body: "  " })).rejects.toThrow(
      /body/i,
    );
  });
});

describe("JobsRepository — assignment", () => {
  it("assign sets assignee and emits job.assigned", async () => {
    const spy = vi.spyOn(emitter, "emit");
    const repo = fresh();
    const j = await repo.create(baseInput);
    spy.mockClear();
    const assigned = await repo.assign(j.id, { assignedTo: "tech-42" });
    expect(assigned.assignedTo).toBe("tech-42");
    const unassigned = await repo.assign(j.id, { assignedTo: null });
    expect(unassigned.assignedTo).toBeUndefined();
    const types = spy.mock.calls.map(
      (c: unknown[]) => (c[0] as { type: string }).type,
    );
    expect(types).toEqual([JOB_EVENTS.assigned, JOB_EVENTS.assigned]);
  });
});

describe("JobsRepository — query", () => {
  it("filters by customerId / vehicleId / quoteId / inspectionId / status / priority / assignedTo and searches text", async () => {
    const repo = fresh();
    const a = await repo.create({ ...baseInput, title: "Brake job" });
    const b = await repo.create({
      customerId: "cust-2",
      vehicleId: "veh-2",
      quoteId: "q-9",
      inspectionId: "insp-9",
      title: "Oil change",
      priority: "high",
      assignedTo: "tech-1",
    });
    await repo.changeStatus(b.id, "scheduled");

    expect((await repo.list({ customerId: "cust-1" })).map((x) => x.id))
      .toEqual([a.id]);
    expect((await repo.list({ vehicleId: "veh-2" })).map((x) => x.id))
      .toEqual([b.id]);
    expect((await repo.list({ quoteId: "q-9" })).map((x) => x.id)).toEqual([
      b.id,
    ]);
    expect((await repo.list({ inspectionId: "insp-9" })).map((x) => x.id))
      .toEqual([b.id]);
    expect((await repo.list({ status: "scheduled" })).map((x) => x.id))
      .toEqual([b.id]);
    expect((await repo.list({ priority: "high" })).map((x) => x.id)).toEqual([
      b.id,
    ]);
    expect((await repo.list({ assignedTo: "tech-1" })).map((x) => x.id))
      .toEqual([b.id]);
    expect((await repo.list({ search: "oil" })).map((x) => x.id)).toEqual([
      b.id,
    ]);
  });
});

describe("JobsRepository — envelope migration", () => {
  it("reads a legacy bare-array payload via v0 migration hook", async () => {
    (
      globalThis as unknown as { localStorage: MemoryStorage }
    ).localStorage.clear();
    // Write a legacy bare-array payload (schemaVersion 0) directly.
    const legacyJob = {
      id: "legacy-1",
      customerId: "cust-1",
      vehicleId: "veh-1",
      title: "Legacy job",
      description: "",
      status: "draft",
      priority: "normal",
      notes: "",
      createdAt: 1,
      updatedAt: 1,
      createdBy: "test",
    };
    localStorage.setItem(
      "skildos.jobs.jobs.v1",
      JSON.stringify([legacyJob]),
    );
    const repo = createLocalJobsRepository();
    const items = await repo.list();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("legacy-1");
    // Subsequent write persists in the new envelope format.
    await repo.update("legacy-1", { title: "Migrated job" });
    const raw = localStorage.getItem("skildos.jobs.jobs.v1");
    expect(raw && JSON.parse(raw)).toMatchObject({ schemaVersion: 1 });
  });
});

describe("JobsRepository — registry swap", () => {
  beforeEach(() => clearRepository(JOBS_REPOSITORY));

  it("registry consumers see whatever repo is registered", () => {
    (
      globalThis as unknown as { localStorage: MemoryStorage }
    ).localStorage.clear();
    const repoA = createLocalJobsRepository();
    registerRepository(JOBS_REPOSITORY, repoA);
    expect(getRepository<JobsRepository>(JOBS_REPOSITORY)).toBe(repoA);

    const repoB = createLocalJobsRepository();
    registerRepository(JOBS_REPOSITORY, repoB);
    expect(getRepository<JobsRepository>(JOBS_REPOSITORY)).toBe(repoB);
    expect(getRepository<JobsRepository>(JOBS_REPOSITORY)).not.toBe(repoA);
  });
});

describe("Jobs — full Customer → Vehicle → Inspection → Quote → Job flow", () => {
  it("integrates repository state and activity sequence end-to-end", async () => {
    const spy = vi.spyOn(emitter, "emit");
    const repo = fresh();
    spy.mockClear();

    // Cross-module identifiers arrive by ID only.
    const customerId = "cust-integration";
    const vehicleId = "veh-integration";
    const inspectionId = "insp-integration";
    const quoteId = "quote-integration";

    const job = await repo.create({
      customerId,
      vehicleId,
      quoteId,
      inspectionId,
      title: "Post-approval brake job",
      description: "Approved from quote v2",
      priority: "high",
    });
    expect(job.quoteId).toBe(quoteId);
    expect(job.inspectionId).toBe(inspectionId);

    await repo.assign(job.id, { assignedTo: "tech-1" });
    await repo.changeStatus(job.id, "scheduled");
    await repo.changeStatus(job.id, "in_progress");
    await repo.addLabor(job.id, {
      description: "Install pads",
      hours: 1.25,
      rateCents: 12000,
    });
    await repo.addNote(job.id, { body: "Rotors within spec." });
    const finished = await repo.changeStatus(job.id, "completed");
    expect(finished.status).toBe("completed");

    const stored = await repo.get(job.id);
    expect(stored?.customerId).toBe(customerId);
    expect(stored?.vehicleId).toBe(vehicleId);
    expect(stored?.assignedTo).toBe("tech-1");

    const history = await repo.listStatusHistory(job.id);
    expect(history.map((h) => h.toStatus)).toEqual([
      "scheduled",
      "in_progress",
      "completed",
    ]);

    const types = spy.mock.calls.map(
      (c: unknown[]) => (c[0] as { type: string }).type,
    );
    expect(types).toEqual([
      JOB_EVENTS.created,
      JOB_EVENTS.assigned,
      JOB_EVENTS.statusChanged,
      JOB_EVENTS.statusChanged,
      JOB_EVENTS.laborAdded,
      JOB_EVENTS.noteAdded,
      JOB_EVENTS.statusChanged,
    ]);
  });
});
