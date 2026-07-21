// Unit tests for the Knowledge local repository.
// Runs in the vitest node environment; installs a minimal in-memory
// localStorage before importing repository code so local-kv can persist.

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
import { createLocalKnowledgeRepository } from "./local-repository";
import { KNOWLEDGE_EVENTS } from "../activity";
import * as emitter from "@/core/activity/emitter";
import type { KnowledgeRepository } from "./repository";

function fresh(): KnowledgeRepository {
  // Reset storage between tests.
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage.clear();
  return createLocalKnowledgeRepository();
}

describe("KnowledgeRepository — documents", () => {
  let emitSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    emitSpy = vi.spyOn(emitter, "emit");
  });

  it("create writes a document at version 1 with an initial version record", async () => {
    const repo = fresh();
    const doc = await repo.createDocument({
      type: "sop",
      title: "Brake pad replacement",
      summary: "Standard SOP",
      content: "Steps…",
      tags: ["brakes"],
    });
    expect(doc.versionNumber).toBe(1);
    expect(doc.status).toBe("draft");
    const versions = await repo.listVersions(doc.id);
    expect(versions).toHaveLength(1);
    expect(versions[0].versionNumber).toBe(1);
    expect(versions[0].changeReason).toBe("Initial version");
  });

  it("two edits produce versions 2 and 3, history preserved", async () => {
    const repo = fresh();
    const doc = await repo.createDocument({
      type: "sop",
      title: "T",
      content: "A",
    });
    const v2 = await repo.updateDocument(doc.id, { content: "B" }, "edit1");
    const v3 = await repo.updateDocument(v2.id, { content: "C" }, "edit2");
    expect(v2.versionNumber).toBe(2);
    expect(v3.versionNumber).toBe(3);
    const versions = await repo.listVersions(doc.id);
    expect(versions.map((v) => v.versionNumber)).toEqual([3, 2, 1]);
    // Historical content is preserved on the version records.
    expect(versions.find((v) => v.versionNumber === 1)?.content).toBe("A");
    expect(versions.find((v) => v.versionNumber === 2)?.content).toBe("B");
    expect(versions.find((v) => v.versionNumber === 3)?.content).toBe("C");
  });

  it("archive does NOT bump version and emits archived event", async () => {
    const repo = fresh();
    const doc = await repo.createDocument({
      type: "sop",
      title: "T",
      content: "A",
    });
    emitSpy.mockClear();
    const archived = await repo.archiveDocument(doc.id);
    expect(archived.versionNumber).toBe(doc.versionNumber);
    expect(archived.status).toBe("archived");
    const versions = await repo.listVersions(doc.id);
    expect(versions).toHaveLength(1);
    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy.mock.calls[0][0].type).toBe(
      KNOWLEDGE_EVENTS.documentArchived,
    );
  });

  it("emits documentCreated on create and version+updated on edit", async () => {
    const repo = fresh();
    emitSpy.mockClear();
    const doc = await repo.createDocument({
      type: "sop",
      title: "T",
      content: "A",
    });
    expect(
      emitSpy.mock.calls.map((c) => c[0].type),
    ).toEqual([KNOWLEDGE_EVENTS.documentCreated]);

    emitSpy.mockClear();
    await repo.updateDocument(doc.id, { content: "B" }, "why");
    const types = emitSpy.mock.calls.map((c) => c[0].type);
    expect(types).toContain(KNOWLEDGE_EVENTS.documentVersionCreated);
    expect(types).toContain(KNOWLEDGE_EVENTS.documentUpdated);
  });

  it("edit without changeReason throws and does not create a version", async () => {
    const repo = fresh();
    const doc = await repo.createDocument({
      type: "sop",
      title: "T",
      content: "A",
    });
    await expect(
      repo.updateDocument(doc.id, { content: "B" }, ""),
    ).rejects.toThrow(/changeReason/i);
    const versions = await repo.listVersions(doc.id);
    expect(versions).toHaveLength(1);
  });

  it("search filters by title/summary/content/tag", async () => {
    const repo = fresh();
    await repo.createDocument({ type: "sop", title: "Brakes", content: "X" });
    await repo.createDocument({
      type: "repair",
      title: "Oil",
      content: "Y",
      tags: ["engine"],
    });
    const byTitle = await repo.listDocuments({ search: "brak" });
    expect(byTitle).toHaveLength(1);
    const byTag = await repo.listDocuments({ tag: "engine" });
    expect(byTag).toHaveLength(1);
    const byType = await repo.listDocuments({ type: "repair" });
    expect(byType).toHaveLength(1);
  });

  it("pricing_rule requires payload and emits pricingRuleUpdated on edit", async () => {
    const repo = fresh();
    await expect(
      repo.createDocument({
        type: "pricing_rule",
        title: "Bad",
        content: "x",
      }),
    ).rejects.toThrow(/pricingRule/);
    const doc = await repo.createDocument({
      type: "pricing_rule",
      title: "Std labor",
      content: "notes",
      pricingRule: {
        name: "Std",
        category: "labor",
        baseLabor: 100,
        markupPercent: 20,
        minimumMargin: 10,
        approvalRequired: false,
      },
    });
    emitSpy.mockClear();
    await repo.updateDocument(
      doc.id,
      {
        pricingRule: {
          name: "Std",
          category: "labor",
          baseLabor: 110,
          markupPercent: 20,
          minimumMargin: 10,
          approvalRequired: true,
        },
      },
      "raise labor",
    );
    const types = emitSpy.mock.calls.map((c) => c[0].type);
    expect(types).toContain(KNOWLEDGE_EVENTS.pricingRuleUpdated);
    expect(types).not.toContain(KNOWLEDGE_EVENTS.documentUpdated);
  });
});

describe("KnowledgeRepository — links", () => {
  it("create + list + remove link", async () => {
    const repo = fresh();
    const doc = await repo.createDocument({
      type: "sop",
      title: "T",
      content: "A",
    });
    const link = await repo.createLink({
      knowledgeId: doc.id,
      targetType: "vehicle.model",
      targetId: "honda.civic",
    });
    let listed = await repo.listLinks({ knowledgeId: doc.id });
    expect(listed).toHaveLength(1);
    expect(listed[0].targetType).toBe("vehicle.model");

    await repo.removeLink(link.id);
    listed = await repo.listLinks({ knowledgeId: doc.id });
    expect(listed).toHaveLength(0);
  });

  it("rejects link creation for missing knowledge doc", async () => {
    const repo = fresh();
    await expect(
      repo.createLink({
        knowledgeId: "missing",
        targetType: "job.type",
        targetId: "x",
      }),
    ).rejects.toThrow(/not found/i);
  });
});

describe("KnowledgeRepository — persistence + migration", () => {
  it("uses envelope shape { schemaVersion, records } after first write", async () => {
    const repo = fresh();
    await repo.createDocument({ type: "sop", title: "T", content: "A" });
    const raw = JSON.parse(
      (globalThis as unknown as { localStorage: Storage }).localStorage.getItem(
        "skildos.knowledge.documents.v1",
      )!,
    );
    expect(raw).toMatchObject({ schemaVersion: 1 });
    expect(Array.isArray(raw.records)).toBe(true);
  });

  it("migrates legacy bare-array payload via the registered hook", async () => {
    // Pretend an older build wrote a bare array (schemaVersion 0).
    const legacy = [
      {
        id: "aaaa",
        type: "sop",
        title: "Legacy",
        summary: "",
        content: "x",
        tags: [],
        status: "active",
        versionNumber: 1,
        createdAt: 0,
        updatedAt: 0,
        createdBy: "op",
      },
    ];
    (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(
      "skildos.knowledge.documents.v1",
      JSON.stringify(legacy),
    );
    const repo = createLocalKnowledgeRepository();
    const docs = await repo.listDocuments();
    expect(docs).toHaveLength(1);
    expect(docs[0].title).toBe("Legacy");
  });
});
