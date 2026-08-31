// Phase 9 — integration foundation tests.
// In-memory localStorage polyfill installed before importing the repository.

import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { createLocalIntegrationRepository } from "./local-repository";
import {
  INTEGRATIONS_REPOSITORY,
  type IntegrationRepository,
} from "./repository";
import {
  clearIntegrationAdapters,
  getIntegrationAdapter,
  hasIntegrationAdapter,
  registerIntegrationAdapter,
} from "./registry";
import { createDeferredAdapter, createStubAdapter } from "./adapters/stub";
import { registerBuiltInAdapters } from "./adapters";
import { connectConnection, disconnectConnection, runSync, testConnection } from "./service";
import { INTEGRATION_EVENTS } from "./activity";
import { INTEGRATION_CAPABILITIES } from "./capabilities";
import { assertNoSecretMaterial, getCredentialResolver } from "./credentials";
import { canTransition } from "./connection-state";
import { IntegrationError, isRetryableCode } from "./errors";
import * as emitter from "@/core/activity/emitter";
import { clearRepository, registerRepository } from "@/core/data/registry";
import { hasCapability, registerCapability } from "@/core/roles/roles";

let repo: IntegrationRepository;

beforeEach(() => {
  localStorage.clear();
  clearRepository();
  clearIntegrationAdapters();
  repo = createLocalIntegrationRepository();
  registerRepository(INTEGRATIONS_REPOSITORY, repo);
  registerBuiltInAdapters();
  vi.restoreAllMocks();
});

// ---- Registry -------------------------------------------------------------

describe("integration registry", () => {
  it("registers and resolves an adapter", () => {
    expect(hasIntegrationAdapter("website")).toBe(true);
    expect(getIntegrationAdapter("website").kind).toBe("stub");
  });

  it("throws for an unknown provider", () => {
    expect(() => getIntegrationAdapter("nope.provider")).toThrow(
      IntegrationError,
    );
  });

  it("lets a consumer see a swapped stub replacement", async () => {
    const consumer = () => getIntegrationAdapter("website").displayName;
    expect(consumer()).toContain("SKILD");

    registerIntegrationAdapter(
      createStubAdapter({ providerId: "website", displayName: "Replaced" }),
    );
    expect(consumer()).toBe("Replaced");
  });
});

// ---- Connection repository ------------------------------------------------

describe("connection repository", () => {
  it("creates a disconnected connection and persists it", async () => {
    const c = await repo.createConnection({
      provider: "website",
      accountLabel: "Website",
    });
    expect(c.status).toBe("disconnected");

    const rehydrated = createLocalIntegrationRepository();
    expect((await rehydrated.listConnections()).map((x) => x.id)).toEqual([c.id]);
  });

  it("stores records under a versioned envelope", async () => {
    await repo.createConnection({ provider: "website", accountLabel: "W" });
    const raw = JSON.parse(
      localStorage.getItem("skildos.integrations.connections.v1")!,
    );
    expect(raw.schemaVersion).toBe(1);
    expect(Array.isArray(raw.records)).toBe(true);
  });

  it("updates account label", async () => {
    const c = await repo.createConnection({ provider: "website", accountLabel: "W" });
    const next = await repo.updateConnection(c.id, { accountLabel: "Shop site" });
    expect(next.accountLabel).toBe("Shop site");
  });

  it("rejects illegal status transitions", async () => {
    const c = await repo.createConnection({ provider: "website", accountLabel: "W" });
    await expect(repo.setConnectionStatus(c.id, "connected")).rejects.toThrow(
      /illegal status transition/,
    );
    expect(canTransition("disconnected", "connected")).toBe(false);
    expect(canTransition("connecting", "connected")).toBe(true);
  });

  it("clears the error once connected and keeps failures visible", async () => {
    const c = await repo.createConnection({ provider: "website", accountLabel: "W" });
    await repo.setConnectionStatus(c.id, "connecting");
    const failed = await repo.setConnectionStatus(c.id, "error", {
      error: new IntegrationError("rate_limited", "Too many requests"),
    });
    expect(failed.status).toBe("error");
    expect(failed.lastErrorCode).toBe("rate_limited");

    await repo.setConnectionStatus(c.id, "connecting");
    const ok = await repo.setConnectionStatus(c.id, "connected");
    expect(ok.lastErrorCode).toBeUndefined();
  });

  it("disconnects through the service", async () => {
    const c = await repo.createConnection({ provider: "website", accountLabel: "W" });
    await connectConnection(c.id);
    const off = await disconnectConnection(c.id);
    expect(off.status).toBe("disconnected");
  });
});

// ---- Credentials ----------------------------------------------------------

describe("credentials", () => {
  it("has no browser credential vault configured", async () => {
    const resolver = getCredentialResolver();
    expect(resolver.backend).toBe("none");
    expect(resolver.supports("google.gmail")).toBe(false);
    await expect(resolver.store("google.gmail", { a: 1 })).rejects.toThrow(
      /no secure credential backend/i,
    );
  });

  it("rejects secret-looking material on connection records", async () => {
    await expect(
      repo.createConnection({
        provider: "website",
        accountLabel: "W",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...({ refreshToken: "abc" } as any),
      }),
    ).rejects.toThrow(/secret material/);
    expect(() =>
      assertNoSecretMaterial({ nested: { api_key: "x" } }, "test"),
    ).toThrow();
  });

  it("never puts secret material into activity events", async () => {
    const spy = vi.spyOn(emitter, "emit");
    const c = await repo.createConnection({ provider: "website", accountLabel: "W" });
    await connectConnection(c.id);
    await runSync(c.id, "lead");

    for (const call of spy.mock.calls) {
      const serialized = JSON.stringify(call[0]).toLowerCase();
      for (const hint of ["token", "secret", "password", "apikey", "bearer"]) {
        expect(serialized).not.toContain(hint);
      }
    }
  });

  it("stores no credentials on persisted connection records", async () => {
    const c = await repo.createConnection({ provider: "website", accountLabel: "W" });
    await connectConnection(c.id);
    const raw = localStorage.getItem("skildos.integrations.connections.v1")!.toLowerCase();
    for (const hint of ["token", "secret", "password", "apikey"]) {
      expect(raw).not.toContain(hint);
    }
    expect(c.credentialRef).toBeUndefined();
  });
});

// ---- Sync -----------------------------------------------------------------

describe("sync", () => {
  it("refuses to sync a connection that is not connected", async () => {
    const c = await repo.createConnection({ provider: "website", accountLabel: "W" });
    await expect(runSync(c.id, "lead")).rejects.toThrow();
  });

  it("records a successful sync and persists sync state", async () => {
    const c = await repo.createConnection({ provider: "website", accountLabel: "W" });
    await connectConnection(c.id);
    const result = await runSync(c.id, "lead");
    expect(result.newRecords).toBe(1);

    const [state] = await repo.listSyncStates(c.id);
    expect(state.status).toBe("succeeded");
    expect(state.cursor).toBeTruthy();

    const conn = await repo.getConnection(c.id);
    expect(conn!.lastSuccessfulSyncAt).toBeTruthy();
  });

  it("records a failed sync with a retryability flag", async () => {
    registerIntegrationAdapter({
      ...createStubAdapter({
        providerId: "website",
        displayName: "Failing",
        capabilities: { readResources: ["lead"] },
      }),
      async sync() {
        throw new IntegrationError("provider_unavailable", "Upstream down");
      },
    });
    const c = await repo.createConnection({ provider: "website", accountLabel: "W" });
    await connectConnection(c.id);
    await expect(runSync(c.id, "lead")).rejects.toThrow("Upstream down");

    const [state] = await repo.listSyncStates(c.id);
    expect(state.status).toBe("failed");
    expect(state.lastErrorCode).toBe("provider_unavailable");
    expect(state.lastErrorRetryable).toBe(true);
    expect(isRetryableCode("invalid_request")).toBe(false);
  });

  it("surfaces a deferred provider as an error, never as connected", async () => {
    const c = await repo.createConnection({
      provider: "google.gmail",
      accountLabel: "skildauto@gmail.com",
    });
    const next = await connectConnection(c.id);
    expect(next.status).toBe("error");
    expect(next.lastErrorCode).toBe("configuration_missing");

    const test = await testConnection(c.id);
    expect(test.ok).toBe(false);
  });
});

// ---- Idempotency ----------------------------------------------------------

describe("external references", () => {
  it("does not duplicate the same external record", async () => {
    const first = await repo.recordExternalReference({
      provider: "google.gmail",
      resourceType: "message",
      externalId: "msg-1",
    });
    const second = await repo.recordExternalReference({
      provider: "google.gmail",
      resourceType: "message",
      externalId: "msg-1",
    });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.reference.id).toBe(first.reference.id);
    expect(await repo.listExternalReferences("google.gmail")).toHaveLength(1);
  });

  it("keeps the same logical import when a sync runs twice", async () => {
    const c = await repo.createConnection({ provider: "website", accountLabel: "W" });
    await connectConnection(c.id);
    await runSync(c.id, "lead");
    const second = await runSync(c.id, "lead");
    expect(second.newRecords).toBe(0);
    expect(await repo.listExternalReferences("website")).toHaveLength(1);
  });

  it("defaults provenance to external_source, not verified truth", async () => {
    const { reference } = await repo.recordExternalReference({
      provider: "ebay",
      resourceType: "order",
      externalId: "o-1",
    });
    expect(reference.provenance).toBe("external_source");
  });
});

// ---- Capabilities & activity ----------------------------------------------

describe("capabilities", () => {
  it("registers provider-agnostic integration capabilities", () => {
    INTEGRATION_CAPABILITIES.forEach(registerCapability);
    registerCapability({
      id: "test.role.cap",
      description: "t",
      ownerModuleId: "test",
    });
    const ids = INTEGRATION_CAPABILITIES.map((c) => c.id);
    expect(ids).toContain("integrations.connect");
    expect(ids.every((id) => !id.includes("gmail"))).toBe(true);
    // Owner role holds "*".
    expect(hasCapability("owner", "integrations.sync")).toBe(true);
  });
});

describe("activity ordering", () => {
  it("emits only after persistence succeeds", async () => {
    const spy = vi.spyOn(emitter, "emit");
    const c = await repo.createConnection({ provider: "website", accountLabel: "W" });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ type: INTEGRATION_EVENTS.connectionCreated }),
    );
    // The record is readable at the moment the event exists.
    expect(await repo.getConnection(c.id)).toBeTruthy();
  });

  it("emits no success event when validation fails", async () => {
    const spy = vi.spyOn(emitter, "emit");
    await expect(
      repo.createConnection({ provider: "website", accountLabel: "  " }),
    ).rejects.toThrow();
    expect(spy).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: INTEGRATION_EVENTS.connectionCreated }),
    );
  });
});

// ---- Cross-module safety --------------------------------------------------

describe("module boundaries", () => {
  it("deferred adapters refuse to connect rather than faking success", async () => {
    const adapter = createDeferredAdapter({
      providerId: "x",
      displayName: "X",
      reason: "deferred",
    });
    await expect(adapter.connect({ connection: {} as never })).rejects.toThrow(
      "deferred",
    );
  });
});
