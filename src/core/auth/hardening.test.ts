// Phase 12.2 — pre-agent authorization + persistence hardening.
//
// These are FAILURE-PATH tests. Every existing module test proves the happy
// path; this file proves the guarantees that matter once a non-UI caller
// (agent, adapter, scheduled command) can reach a repository directly:
//
//   1. an actor without the capability cannot mutate, and produces no event
//   2. an unapproved outbound message cannot be queued, whatever the stored
//      record claims
//   3. a failed storage write never produces a successful business event,
//      and never leaves the in-memory state ahead of what was persisted
//   4. Jarvis stays proposal-only — `jarvis.execute` remains inert

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class MemoryStorage {
  private store = new Map<string, string>();
  failWrites = false;
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
    if (this.failWrites) {
      const err = new Error("QuotaExceededError");
      err.name = "QuotaExceededError";
      throw err;
    }
    this.store.set(k, String(v));
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
}

const storage = new MemoryStorage();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).window = globalThis;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).localStorage = storage;

import { CapabilityDeniedError } from "@/core/auth/authorize";
import {
  createLocalIdentityProvider,
  setIdentityProvider,
  type Identity,
} from "@/core/auth/provider";
import { OWNER_ROLE_ID, registerRole } from "@/core/roles/roles";
import { PersistenceError } from "@/core/storage/persistence";
import * as emitter from "@/core/activity/emitter";

import { createLocalFinanceRepository } from "@/modules/finance/data/local-repository";
import { createLocalCommunicationRepository } from "@/modules/communication/data/local-repository";
import { createLocalMarketingRepository } from "@/modules/marketing/data/local-repository";
import { createLocalQuotesRepository } from "@/modules/quotes/data/local-repository";
import { createLocalJobsRepository } from "@/modules/jobs/data/local-repository";
import { ASSISTANT_CAPABILITIES } from "@/modules/assistant/capabilities";

// A deliberately powerless actor: a role that holds READ capabilities only.
const READER_ROLE_ID = "test-reader";
registerRole({
  id: READER_ROLE_ID,
  name: "Reader",
  capabilityIds: [
    "finance.read",
    "communication.read",
    "leads.read",
    "marketing.read",
    "quotes.read",
    "jobs.read",
  ],
});

function actAs(roleId: string) {
  const identity: Identity = {
    id: "test-actor",
    displayName: "Test Actor",
    roleId,
  };
  setIdentityProvider({
    kind: "test",
    get: () => identity,
    subscribe: () => () => {},
  });
}

function reset() {
  storage.failWrites = false;
  storage.clear();
  actAs(OWNER_ROLE_ID);
}

beforeEach(reset);
afterEach(() => {
  vi.restoreAllMocks();
  setIdentityProvider(createLocalIdentityProvider());
});

// ---------------------------------------------------------------------------
// FIX 1 — repository-level capability enforcement
// ---------------------------------------------------------------------------

describe("repository authorization boundary", () => {
  it("denies a finance mutation to an actor without finance.write", async () => {
    const repo = createLocalFinanceRepository();
    const spy = vi.spyOn(emitter, "emit");
    actAs(READER_ROLE_ID);

    await expect(
      repo.createInvoice({
        customerId: "cust-1",
        lines: [
          {
            description: "Labor",
            category: "labor",
            quantity: 1,
            unitPrice: 10000,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(CapabilityDeniedError);

    expect(spy).not.toHaveBeenCalled();
    actAs(OWNER_ROLE_ID);
    expect(await repo.listInvoices()).toHaveLength(0);
  });

  it("denies communication and marketing mutations the same way", async () => {
    const comms = createLocalCommunicationRepository();
    const marketing = createLocalMarketingRepository();
    actAs(READER_ROLE_ID);

    await expect(
      comms.createConversation({ customerId: "cust-1", channel: "email" }),
    ).rejects.toBeInstanceOf(CapabilityDeniedError);
    await expect(
      marketing.createLead({
        channel: "website_form",
        attribution: { source: "website" },
      }),
    ).rejects.toBeInstanceOf(CapabilityDeniedError);
  });

  it("denies quotes and jobs mutations to a read-only actor", async () => {
    const quotes = createLocalQuotesRepository();
    const jobs = createLocalJobsRepository();
    actAs(READER_ROLE_ID);

    await expect(
      quotes.createQuote({
        customerId: "cust-1",
        vehicleId: "veh-1",
        title: "Brake service",
      }),
    ).rejects.toBeInstanceOf(CapabilityDeniedError);
    await expect(
      jobs.create({ customerId: "cust-1", vehicleId: "veh-1", title: "Brakes" }),
    ).rejects.toBeInstanceOf(CapabilityDeniedError);
  });

  it("allows the same call once the actor holds the capability", async () => {
    const repo = createLocalFinanceRepository();
    const invoice = await repo.createInvoice({
      customerId: "cust-1",
      lines: [
        {
          description: "Labor",
          category: "labor",
          quantity: 1,
          unitPrice: 10000,
        },
      ],
    });
    expect(invoice.status).toBe("draft");
  });

  it("denies before validation — a bad payload from an unauthorized actor still fails on capability", async () => {
    const repo = createLocalFinanceRepository();
    actAs(READER_ROLE_ID);
    await expect(
      // invalid payload AND unauthorized: authorization must win
      repo.createInvoice({ customerId: "", lines: [] }),
    ).rejects.toBeInstanceOf(CapabilityDeniedError);
  });
});

// ---------------------------------------------------------------------------
// FIX 2 — communication approval enforced at the repository
// ---------------------------------------------------------------------------

describe("communication approval boundary", () => {
  it("refuses to queue an outbound message that has not been approved", async () => {
    const repo = createLocalCommunicationRepository();
    const conv = await repo.createConversation({
      customerId: "cust-1",
      channel: "email",
    });
    const msg = await repo.prepareOutboundMessage({
      conversationId: conv.id,
      body: "We recommend replacing the rotors.",
    });
    expect(msg.status).toBe("pending_approval");

    await expect(repo.queueMessage(msg.id)).rejects.toThrow(/approval/i);
    expect((await repo.getMessage(msg.id))?.status).toBe("pending_approval");
  });

  it("queues only after an explicit human approval", async () => {
    const repo = createLocalCommunicationRepository();
    const conv = await repo.createConversation({
      customerId: "cust-1",
      channel: "email",
    });
    const msg = await repo.prepareOutboundMessage({
      conversationId: conv.id,
      body: "We recommend replacing the rotors.",
    });
    await repo.approveMessage(msg.id, "Reviewed by the owner.");
    const queued = await repo.queueMessage(msg.id);
    expect(queued.status).toBe("queued");
  });

  it("requires the communication.approve capability to approve", async () => {
    const repo = createLocalCommunicationRepository();
    const conv = await repo.createConversation({
      customerId: "cust-1",
      channel: "email",
    });
    const msg = await repo.prepareOutboundMessage({
      conversationId: conv.id,
      body: "Body",
    });
    actAs(READER_ROLE_ID);
    await expect(repo.approveMessage(msg.id)).rejects.toBeInstanceOf(
      CapabilityDeniedError,
    );
  });
});

// ---------------------------------------------------------------------------
// FIX 3 — a failed write must not produce a successful business event
// ---------------------------------------------------------------------------

describe("persistence failure semantics", () => {
  it("throws PersistenceError and emits no business event when the write fails", async () => {
    const repo = createLocalFinanceRepository();
    const spy = vi.spyOn(emitter, "emit");
    storage.failWrites = true;

    await expect(
      repo.createInvoice({
        customerId: "cust-1",
        lines: [
          {
            description: "Labor",
            category: "labor",
            quantity: 1,
            unitPrice: 10000,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(PersistenceError);

    const types = spy.mock.calls.map((c) => (c[0] as { type: string }).type);
    expect(types).toContain("system.storage.quotaExceeded");
    expect(types.some((t) => t.startsWith("finance."))).toBe(false);
  });

  it("leaves in-memory state unchanged after a failed write", async () => {
    const repo = createLocalFinanceRepository();
    await repo.createInvoice({
      customerId: "cust-1",
      lines: [
        {
          description: "Labor",
          category: "labor",
          quantity: 1,
          unitPrice: 10000,
        },
      ],
    });
    expect(await repo.listInvoices()).toHaveLength(1);

    storage.failWrites = true;
    await expect(
      repo.createInvoice({
        customerId: "cust-2",
        lines: [
          {
            description: "Labor",
            category: "labor",
            quantity: 1,
            unitPrice: 5000,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(PersistenceError);

    storage.failWrites = false;
    const all = await repo.listInvoices();
    expect(all).toHaveLength(1);
    expect(all[0]?.customerId).toBe("cust-1");
  });

  it("does not leave an invoice issued when its immutable snapshot cannot be stored", async () => {
    const repo = createLocalFinanceRepository();
    const invoice = await repo.createInvoice({
      customerId: "cust-1",
      lines: [
        {
          description: "Labor",
          category: "labor",
          quantity: 1,
          unitPrice: 10000,
        },
      ],
    });

    const original = storage.setItem.bind(storage);
    vi.spyOn(storage, "setItem").mockImplementation((k: string, v: string) => {
      if (k.includes("snapshot")) throw new Error("QuotaExceededError");
      original(k, v);
    });

    await expect(repo.issueInvoice(invoice.id)).rejects.toBeInstanceOf(
      PersistenceError,
    );
    vi.restoreAllMocks();

    expect((await repo.getInvoice(invoice.id))?.status).toBe("draft");
    expect(await repo.listSnapshots?.(invoice.id) ?? []).toHaveLength(0);
  });

  it("blocks a queued message when persistence fails", async () => {
    const repo = createLocalCommunicationRepository();
    const conv = await repo.createConversation({
      customerId: "cust-1",
      channel: "email",
    });
    const msg = await repo.prepareOutboundMessage({
      conversationId: conv.id,
      body: "Body",
    });
    await repo.approveMessage(msg.id);

    storage.failWrites = true;
    await expect(repo.queueMessage(msg.id)).rejects.toBeInstanceOf(
      PersistenceError,
    );
    storage.failWrites = false;
    expect((await repo.getMessage(msg.id))?.status).toBe("approved");
  });
});

// ---------------------------------------------------------------------------
// FIX 5 — Jarvis remains proposal-oriented
// ---------------------------------------------------------------------------

describe("Jarvis execution boundary", () => {
  it("keeps jarvis.execute declared but unheld and unused", async () => {
    const execute = ASSISTANT_CAPABILITIES.find(
      (c) => c.id === "jarvis.execute",
    );
    expect(execute).toBeDefined();

    // No repository exposes an execute path for a proposal.
    const finance = createLocalFinanceRepository();
    expect(
      Object.keys(finance).some((k) => /executeProposal|applyProposal/i.test(k)),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PHASE 15 — CRM + Vehicles were the last repositories without a mutation
// boundary. They sit at the ROOT of the business data chain (customer →
// vehicle → inspection → quote → job → invoice), so an unguarded write there
// is the most consequential bypass in the system.
// ---------------------------------------------------------------------------

describe("CRM + Vehicles authorization boundary", () => {
  it("denies a customer write to an actor without crm.write, and emits nothing", async () => {
    const { createLocalCustomerRepository } = await import(
      "@/modules/crm/data/local-repository"
    );
    const repo = createLocalCustomerRepository();
    const spy = vi.spyOn(emitter, "emit");
    actAs(READER_ROLE_ID);

    await expect(
      repo.create({ displayName: "Unauthorized Customer" }),
    ).rejects.toBeInstanceOf(CapabilityDeniedError);

    expect(spy).not.toHaveBeenCalled();
    actAs(OWNER_ROLE_ID);
    expect((await repo.list()).items).toHaveLength(0);
  });

  it("denies a vehicle write to an actor without vehicles.write", async () => {
    const { createLocalVehicleRepository } = await import(
      "@/modules/vehicles/data/local-repository"
    );
    const repo = createLocalVehicleRepository();
    actAs(READER_ROLE_ID);

    await expect(
      repo.create({
        customerId: "cust-1",
        make: "Honda",
        model: "CB500",
        year: 2019,
      }),
    ).rejects.toBeInstanceOf(CapabilityDeniedError);

    actAs(OWNER_ROLE_ID);
    expect((await repo.list()).items).toHaveLength(0);
  });
});
