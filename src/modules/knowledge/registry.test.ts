// Integration test: repository registry swap + capability filtering.
// Verifies that:
//   1. Consumers reading via the data registry see whichever repository
//      is currently registered (swap works without touching consumers).
//   2. filterVisibleCommands respects capability requirements.

import { beforeEach, describe, expect, it } from "vitest";
import {
  clearRepository,
  getRepository,
  registerRepository,
} from "@/core/data/registry";
import {
  KNOWLEDGE_REPOSITORY,
  type KnowledgeRepository,
} from "./data/repository";
import { filterVisibleCommands, registerCommand } from "@/core/commands/registry";
import { getIdentity } from "@/core/auth/identity";

function stub(name: string): KnowledgeRepository {
  return {
    async listDocuments() {
      return [{ __from: name } as unknown as never];
    },
    async getDocument() {
      return undefined;
    },
    async createDocument() {
      throw new Error("not implemented");
    },
    async updateDocument() {
      throw new Error("not implemented");
    },
    async archiveDocument() {
      throw new Error("not implemented");
    },
    async listVersions() {
      return [];
    },
    async getVersion() {
      return undefined;
    },
    async listLinks() {
      return [];
    },
    async createLink() {
      throw new Error("not implemented");
    },
    async removeLink() {
      return;
    },
    subscribe() {
      return () => {};
    },
  };
}

describe("Knowledge — repository swap", () => {
  beforeEach(() => clearRepository(KNOWLEDGE_REPOSITORY));

  it("consumers see the currently registered implementation", async () => {
    registerRepository(KNOWLEDGE_REPOSITORY, stub("A"));
    const a = getRepository<KnowledgeRepository>(KNOWLEDGE_REPOSITORY);
    const aResult = (await a.listDocuments()) as unknown as Array<{
      __from: string;
    }>;
    expect(aResult[0].__from).toBe("A");

    registerRepository(KNOWLEDGE_REPOSITORY, stub("B"));
    const b = getRepository<KnowledgeRepository>(KNOWLEDGE_REPOSITORY);
    const bResult = (await b.listDocuments()) as unknown as Array<{
      __from: string;
    }>;
    expect(bResult[0].__from).toBe("B");
  });
});

describe("Knowledge — capability filtering", () => {
  it("hides commands requiring capabilities the identity lacks", () => {
    // Register a knowledge command; Owner (default identity) holds "*",
    // so it should always be visible. A stub role with no caps should not.
    registerCommand({
      id: "knowledge.test.gated",
      label: "Gated",
      requiredCapabilityIds: ["knowledge.write"],
      run: () => {},
    });
    const cmd = {
      id: "knowledge.test.gated",
      label: "Gated",
      requiredCapabilityIds: ["knowledge.write"],
      run: () => {},
    };
    const visibleForOwner = filterVisibleCommands([cmd], getIdentity());
    expect(visibleForOwner).toHaveLength(1);

    const nobody = { ...getIdentity(), roleId: "no-such-role" };
    const visibleForNobody = filterVisibleCommands([cmd], nobody);
    expect(visibleForNobody).toHaveLength(0);
  });
});
