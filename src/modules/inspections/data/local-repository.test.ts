// Unit tests for the Inspections local repository.
// Node vitest env; installs a minimal in-memory localStorage before importing
// repository code so local-kv can persist. Mirrors the Knowledge test setup.

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

// Now import the module under test (after the polyfill).
import { createLocalInspectionsRepository } from "./local-repository";
import { INSPECTION_EVENTS } from "../activity";
import * as emitter from "@/core/activity/emitter";
import type { InspectionsRepository } from "./repository";

function fresh(): InspectionsRepository {
  (
    globalThis as unknown as { localStorage: MemoryStorage }
  ).localStorage.clear();
  return createLocalInspectionsRepository();
}

async function seedVehicleAndCustomer() {
  return { vehicleId: "veh-1", customerId: "cust-1" };
}

describe("InspectionsRepository — templates", () => {
  it("creates a template and emits templateCreated", async () => {
    const spy = vi.spyOn(emitter, "emit");
    const repo = fresh();
    spy.mockClear();
    const t = await repo.createTemplate({
      name: "Basic 30-point",
      description: "Standard used-car check",
    });
    expect(t.name).toBe("Basic 30-point");
    expect(t.sections).toEqual([]);
    const listed = await repo.listTemplates();
    expect(listed).toHaveLength(1);
    expect(
      spy.mock.calls.map((c: unknown[]) => (c[0] as { type: string }).type),
    ).toEqual([INSPECTION_EVENTS.templateCreated]);
  });

  it("rejects blank template names", async () => {
    const repo = fresh();
    await expect(repo.createTemplate({ name: "" })).rejects.toThrow(/name/i);
  });
});

describe("InspectionsRepository — inspections", () => {
  it("creates an inspection with default status draft and empty findings", async () => {
    const repo = fresh();
    const { vehicleId, customerId } = await seedVehicleAndCustomer();
    const i = await repo.createInspection({ vehicleId, customerId });
    expect(i.status).toBe("draft");
    expect(i.findings).toEqual([]);
    expect(i.vehicleId).toBe(vehicleId);
  });

  it("requires vehicleId and customerId", async () => {
    const repo = fresh();
    await expect(
      repo.createInspection({ vehicleId: "", customerId: "c" }),
    ).rejects.toThrow(/vehicleId/);
    await expect(
      repo.createInspection({ vehicleId: "v", customerId: "" }),
    ).rejects.toThrow(/customerId/);
  });

  it("rejects unknown templateId", async () => {
    const repo = fresh();
    await expect(
      repo.createInspection({
        vehicleId: "v",
        customerId: "c",
        templateId: "missing",
      }),
    ).rejects.toThrow(/template/);
  });

  it("updateInspection emits inspectionUpdated with changed fields", async () => {
    const spy = vi.spyOn(emitter, "emit");
    const repo = fresh();
    const i = await repo.createInspection({
      vehicleId: "v",
      customerId: "c",
    });
    spy.mockClear();
    const next = await repo.updateInspection(i.id, {
      status: "in_progress",
      notes: "started",
    });
    expect(next.status).toBe("in_progress");
    expect(next.notes).toBe("started");
    const types = spy.mock.calls.map(
      (c: unknown[]) => (c[0] as { type: string }).type,
    );
    expect(types).toContain(INSPECTION_EVENTS.inspectionUpdated);
  });
});

describe("InspectionsRepository — findings", () => {
  it("creates a finding, appends id to inspection.findings, and emits", async () => {
    const spy = vi.spyOn(emitter, "emit");
    const repo = fresh();
    const i = await repo.createInspection({
      vehicleId: "v",
      customerId: "c",
    });
    spy.mockClear();
    const f = await repo.createFinding({
      inspectionId: i.id,
      category: "brakes",
      title: "Pads at 3mm",
      severity: "required",
    });
    expect(f.inspectionId).toBe(i.id);
    expect(f.status).toBe("open");
    const listed = await repo.listFindings(i.id);
    expect(listed.map((x) => x.id)).toEqual([f.id]);
    const parent = await repo.getInspection(i.id);
    expect(parent?.findings).toEqual([f.id]);
    const types = spy.mock.calls.map(
      (c: unknown[]) => (c[0] as { type: string }).type,
    );
    expect(types).toContain(INSPECTION_EVENTS.findingCreated);
  });

  it("rejects invalid severity", async () => {
    const repo = fresh();
    const i = await repo.createInspection({
      vehicleId: "v",
      customerId: "c",
    });
    await expect(
      repo.createFinding({
        inspectionId: i.id,
        category: "x",
        title: "t",
        // @ts-expect-error deliberately invalid
        severity: "catastrophic",
      }),
    ).rejects.toThrow(/severity/);
  });

  it("updateFinding emits findingUpdated", async () => {
    const spy = vi.spyOn(emitter, "emit");
    const repo = fresh();
    const i = await repo.createInspection({
      vehicleId: "v",
      customerId: "c",
    });
    const f = await repo.createFinding({
      inspectionId: i.id,
      category: "tires",
      title: "Front left low",
      severity: "advisory",
    });
    spy.mockClear();
    const next = await repo.updateFinding(f.id, { status: "resolved" });
    expect(next.status).toBe("resolved");
    const types = spy.mock.calls.map(
      (c: unknown[]) => (c[0] as { type: string }).type,
    );
    expect(types).toContain(INSPECTION_EVENTS.findingUpdated);
  });
});

describe("InspectionsRepository — photos + upload queue", () => {
  it("queuePhoto persists photo, emits photoQueued, and appends to finding.mediaKeys", async () => {
    const spy = vi.spyOn(emitter, "emit");
    const repo = fresh();
    const i = await repo.createInspection({
      vehicleId: "v",
      customerId: "c",
    });
    const f = await repo.createFinding({
      inspectionId: i.id,
      category: "body",
      title: "Scratch",
      severity: "info",
    });
    spy.mockClear();
    const photo = await repo.queuePhoto({
      inspectionId: i.id,
      findingId: f.id,
    });
    expect(photo.uploadStatus).toBe("queued");
    expect(photo.logicalKey.startsWith(`inspections/${i.id}/photos/`)).toBe(
      true,
    );
    const photos = await repo.listPhotos(i.id);
    expect(photos).toHaveLength(1);
    const findings = await repo.listFindings(i.id);
    expect(findings[0].mediaKeys).toEqual([photo.logicalKey]);
    const types = spy.mock.calls.map(
      (c: unknown[]) => (c[0] as { type: string }).type,
    );
    expect(types).toContain(INSPECTION_EVENTS.photoQueued);
  });

  it("rejects queuePhoto for unknown inspection", async () => {
    const repo = fresh();
    await expect(
      repo.queuePhoto({ inspectionId: "missing" }),
    ).rejects.toThrow(/inspection/i);
  });
});

describe("InspectionsRepository — persistence + migration", () => {
  beforeEach(() => {
    (
      globalThis as unknown as { localStorage: MemoryStorage }
    ).localStorage.clear();
  });

  it("uses envelope shape { schemaVersion, records } after first write", async () => {
    const repo = fresh();
    await repo.createInspection({ vehicleId: "v", customerId: "c" });
    const raw = JSON.parse(
      (globalThis as unknown as { localStorage: Storage }).localStorage.getItem(
        "skildos.inspections.inspections.v1",
      )!,
    );
    expect(raw).toMatchObject({ schemaVersion: 1 });
    expect(Array.isArray(raw.records)).toBe(true);
  });

  it("migrates legacy bare-array payload via the registered hook", async () => {
    const legacy = [
      {
        id: "insp-legacy",
        vehicleId: "v",
        customerId: "c",
        status: "draft",
        findings: [],
        notes: "",
        createdBy: "op",
        createdAt: 0,
        updatedAt: 0,
      },
    ];
    (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(
      "skildos.inspections.inspections.v1",
      JSON.stringify(legacy),
    );
    const repo = createLocalInspectionsRepository();
    const items = await repo.listInspections();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("insp-legacy");
  });
});

describe("Inspections — integration: customer → vehicle → inspection → finding → photo", () => {
  it("emits the full event sequence end-to-end", async () => {
    const spy = vi.spyOn(emitter, "emit");
    const repo = fresh();
    spy.mockClear();

    // Customer + vehicle are simulated as opaque ids — CRM/Vehicles modules
    // own those records; Inspections only stores their ids.
    const inspection = await repo.createInspection({
      vehicleId: "veh-integ",
      customerId: "cust-integ",
    });
    const finding = await repo.createFinding({
      inspectionId: inspection.id,
      category: "brakes",
      title: "Rotor scored",
      severity: "required",
    });
    await repo.queuePhoto({
      inspectionId: inspection.id,
      findingId: finding.id,
    });

    const types = spy.mock.calls.map(
      (c: unknown[]) => (c[0] as { type: string }).type,
    );
    expect(types).toEqual([
      INSPECTION_EVENTS.inspectionCreated,
      INSPECTION_EVENTS.findingCreated,
      INSPECTION_EVENTS.photoQueued,
    ]);
  });
});
