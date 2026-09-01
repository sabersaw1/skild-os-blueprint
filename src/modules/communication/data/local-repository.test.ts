// Unit + integration tests for the Communication local repository.
// Mirrors the Finance / Parts / Jobs test setup: in-memory localStorage
// polyfill installed before importing the repository module.

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

import { createLocalCommunicationRepository } from "./local-repository";
import { COMMUNICATION_EVENTS } from "../activity";
import * as emitter from "@/core/activity/emitter";
import {
  clearRepository,
  getRepository,
  registerRepository,
} from "@/core/data/registry";
import {
  COMMUNICATION_REPOSITORY,
  type CommunicationRepository,
} from "./repository";
import { isUuidV4 } from "@/core/ids";
import { readEnvelope } from "./storage";

const storage = () =>
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage;

function fresh(): CommunicationRepository {
  storage().clear();
  clearRepository();
  return createLocalCommunicationRepository();
}

async function thread(repo: CommunicationRepository, over: object = {}) {
  return repo.createConversation({
    customerId: "cust-1",
    channel: "website",
    subject: "Brake noise",
    ...over,
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("conversations", () => {
  it("creates a conversation with a UUID id and open state", async () => {
    const repo = fresh();
    const c = await thread(repo);
    expect(isUuidV4(c.id)).toBe(true);
    expect(c.status).toBe("open");
    expect(c.awaitingParty).toBe("none");
    expect(c.refs).toEqual([]);
    expect(c.customerId).toBe("cust-1");
  });

  it("rejects a conversation without a customer and emits nothing", async () => {
    const repo = fresh();
    const spy = vi.spyOn(emitter, "emit");
    await expect(
      repo.createConversation({ customerId: "  ", channel: "email" }),
    ).rejects.toThrow(/customerId/i);
    expect(spy).not.toHaveBeenCalled();
    expect(await repo.listConversations()).toHaveLength(0);
  });

  it("rejects an invalid channel", async () => {
    const repo = fresh();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      repo.createConversation({ customerId: "c", channel: "pigeon" as any }),
    ).rejects.toThrow(/invalid channel/i);
  });

  it("validates the customer reference against a registered CRM repository", async () => {
    const repo = fresh();
    registerRepository("crm.customerRepository", {
      get: async (id: string) => (id === "known" ? { id } : undefined),
    });
    await expect(
      repo.createConversation({ customerId: "ghost", channel: "email" }),
    ).rejects.toThrow(/unknown customer/i);
    const ok = await repo.createConversation({
      customerId: "known",
      channel: "email",
    });
    expect(ok.customerId).toBe("known");
  });

  it("validates the vehicle reference", async () => {
    const repo = fresh();
    registerRepository("vehicles.vehicleRepository", {
      get: async (id: string) => (id === "veh-1" ? { id } : undefined),
    });
    await expect(
      thread(repo, { vehicleId: "nope" }),
    ).rejects.toThrow(/unknown vehicle/i);
    const ok = await thread(repo, { vehicleId: "veh-1" });
    expect(ok.vehicleId).toBe("veh-1");
  });

  it("changes status and derives awaitingParty", async () => {
    const repo = fresh();
    const c = await thread(repo);
    const next = await repo.setConversationStatus(c.id, "awaiting_customer");
    expect(next.awaitingParty).toBe("customer");
    const resolved = await repo.setConversationStatus(c.id, "resolved");
    expect(resolved.awaitingParty).toBe("none");
  });

  it("emits a status change event after persistence", async () => {
    const repo = fresh();
    const c = await thread(repo);
    const spy = vi.spyOn(emitter, "emit");
    await repo.setConversationStatus(c.id, "awaiting_skild");
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: COMMUNICATION_EVENTS.conversationStatusChanged,
        moduleId: "communication",
      }),
    );
    const stored = await repo.getConversation(c.id);
    expect(stored?.status).toBe("awaiting_skild");
  });

  it("rejects an invalid status without mutating", async () => {
    const repo = fresh();
    const c = await thread(repo);
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      repo.setConversationStatus(c.id, "sleeping" as any),
    ).rejects.toThrow(/invalid conversation status/i);
    expect((await repo.getConversation(c.id))?.status).toBe("open");
  });
});

describe("entity links", () => {
  it("links business entities idempotently", async () => {
    const repo = fresh();
    const c = await thread(repo);
    await repo.linkEntity(c.id, { type: "quote", id: "q-1" });
    const twice = await repo.linkEntity(c.id, { type: "quote", id: "q-1" });
    expect(twice.refs).toHaveLength(1);
    const unlinked = await repo.unlinkEntity(c.id, { type: "quote", id: "q-1" });
    expect(unlinked.refs).toHaveLength(0);
  });

  it("validates quote / job / invoice references through the registry", async () => {
    const repo = fresh();
    const c = await thread(repo);
    registerRepository("quotes.repository", {
      getQuote: async (id: string) => (id === "q-1" ? { id } : undefined),
    });
    registerRepository("jobs.repository", {
      getJob: async (id: string) => (id === "j-1" ? { id } : undefined),
    });
    registerRepository("finance.repository", {
      getInvoice: async (id: string) => (id === "i-1" ? { id } : undefined),
    });

    await expect(
      repo.linkEntity(c.id, { type: "quote", id: "bad" }),
    ).rejects.toThrow(/unknown quote/i);
    await expect(
      repo.linkEntity(c.id, { type: "job", id: "bad" }),
    ).rejects.toThrow(/unknown job/i);
    await expect(
      repo.linkEntity(c.id, { type: "invoice", id: "bad" }),
    ).rejects.toThrow(/unknown invoice/i);

    await repo.linkEntity(c.id, { type: "quote", id: "q-1" });
    await repo.linkEntity(c.id, { type: "job", id: "j-1" });
    const linked = await repo.linkEntity(c.id, { type: "invoice", id: "i-1" });
    expect(linked.refs.map((r) => r.type).sort()).toEqual([
      "invoice",
      "job",
      "quote",
    ]);
  });

  it("filters conversations by referenced entity", async () => {
    const repo = fresh();
    const a = await thread(repo);
    await thread(repo, { subject: "Other" });
    await repo.linkEntity(a.id, { type: "job", id: "j-9" });
    const found = await repo.listConversations({
      ref: { type: "job", id: "j-9" },
    });
    expect(found.map((c) => c.id)).toEqual([a.id]);
  });
});

describe("messages", () => {
  it("records an inbound message and flips the thread to awaiting_skild", async () => {
    const repo = fresh();
    const c = await thread(repo);
    const m = await repo.recordInboundMessage({
      conversationId: c.id,
      body: "My brakes squeal.",
    });
    expect(m.direction).toBe("inbound");
    expect(m.status).toBe("received");
    const updated = await repo.getConversation(c.id);
    expect(updated?.status).toBe("awaiting_skild");
    expect(updated?.awaitingParty).toBe("skild");
    expect(updated?.lastCustomerMessageAt).toBeDefined();
  });

  it("rejects an empty body and emits nothing", async () => {
    const repo = fresh();
    const c = await thread(repo);
    const spy = vi.spyOn(emitter, "emit");
    await expect(
      repo.recordInboundMessage({ conversationId: c.id, body: "   " }),
    ).rejects.toThrow(/body is required/i);
    expect(spy).not.toHaveBeenCalled();
    expect(await repo.listMessages({ conversationId: c.id })).toHaveLength(0);
  });

  it("rejects a message on an unknown conversation", async () => {
    const repo = fresh();
    await expect(
      repo.recordInboundMessage({ conversationId: "nope", body: "hi" }),
    ).rejects.toThrow(/unknown conversation/i);
  });

  it("adds internal notes without changing who we wait on", async () => {
    const repo = fresh();
    const c = await thread(repo);
    await repo.setConversationStatus(c.id, "awaiting_customer");
    await repo.addInternalNote({ conversationId: c.id, body: "Check parts." });
    const updated = await repo.getConversation(c.id);
    expect(updated?.awaitingParty).toBe("customer");
    const notes = await repo.listMessages({
      conversationId: c.id,
      direction: "internal",
    });
    expect(notes).toHaveLength(1);
    expect(notes[0].type).toBe("internal_note");
  });

  it("orders messages chronologically", async () => {
    const repo = fresh();
    const c = await thread(repo);
    await repo.recordInboundMessage({
      conversationId: c.id,
      body: "first",
      receivedAt: 1000,
    });
    await repo.recordInboundMessage({
      conversationId: c.id,
      body: "second",
      receivedAt: 2000,
      idempotencyKey: "k2",
    });
    const list = await repo.listMessages({ conversationId: c.id });
    expect(list.map((m) => m.body)).toEqual(["first", "second"]);
  });
});

describe("outbound lifecycle and human approval", () => {
  it("prepares a general message as pending_approval and never sends it", async () => {
    const repo = fresh();
    const c = await thread(repo);
    const m = await repo.prepareOutboundMessage({
      conversationId: c.id,
      body: "Here is what we found.",
    });
    expect(m.status).toBe("pending_approval");
    expect(m.requiresApproval).toBe(true);
    expect(m.sentAt).toBeUndefined();
    expect(m.externalMessageId).toBeUndefined();
    // The thread does NOT move to awaiting_customer until a real send.
    expect((await repo.getConversation(c.id))?.awaitingParty).toBe("none");
  });

  it("prepares a routine operational message as a draft", async () => {
    const repo = fresh();
    const c = await thread(repo);
    const m = await repo.prepareOutboundMessage({
      conversationId: c.id,
      body: "Your appointment is confirmed.",
      type: "appointment_confirmation",
    });
    expect(m.requiresApproval).toBe(false);
    expect(m.status).toBe("draft");
  });

  it("honours a forced approval requirement", async () => {
    const repo = fresh();
    const c = await thread(repo);
    const m = await repo.prepareOutboundMessage({
      conversationId: c.id,
      body: "Unusual situation.",
      type: "job_status",
      requireApproval: true,
      approvalReason: "Non-standard commitment.",
    });
    expect(m.status).toBe("pending_approval");
    expect(m.approvalReason).toBe("Non-standard commitment.");
  });

  it("refuses to queue an approval-required message before approval", async () => {
    const repo = fresh();
    const c = await thread(repo);
    const m = await repo.prepareOutboundMessage({
      conversationId: c.id,
      body: "Your quote is ready.",
      type: "quote_notification",
    });
    await expect(repo.queueMessage(m.id)).rejects.toThrow(/human approval/i);
    const approved = await repo.approveMessage(m.id);
    expect(approved.status).toBe("approved");
    expect(approved.approvedBy).toBeTruthy();
    const queued = await repo.queueMessage(m.id);
    expect(queued.status).toBe("queued");
  });

  it("records a send result and flips the thread to awaiting_customer", async () => {
    const repo = fresh();
    const c = await thread(repo);
    const m = await repo.prepareOutboundMessage({
      conversationId: c.id,
      body: "Confirmed for Tuesday.",
      type: "appointment_confirmation",
    });
    await repo.queueMessage(m.id);
    const sent = await repo.recordSendResult(m.id, {
      externalMessageId: "provider-abc",
    });
    expect(sent.status).toBe("sent");
    expect(sent.sentAt).toBeDefined();
    const updated = await repo.getConversation(c.id);
    expect(updated?.awaitingParty).toBe("customer");
    expect(updated?.lastOutboundMessageAt).toBeDefined();
  });

  it("records a failure without marking the message sent", async () => {
    const repo = fresh();
    const c = await thread(repo);
    const m = await repo.prepareOutboundMessage({
      conversationId: c.id,
      body: "Reminder.",
      type: "appointment_reminder",
    });
    await repo.queueMessage(m.id);
    const failed = await repo.recordSendResult(m.id, {
      failureReason: "adapter unavailable",
    });
    expect(failed.status).toBe("failed");
    expect(failed.sentAt).toBeUndefined();
    expect((await repo.getConversation(c.id))?.awaitingParty).toBe("none");
  });

  it("cannot cancel a sent message", async () => {
    const repo = fresh();
    const c = await thread(repo);
    const m = await repo.prepareOutboundMessage({
      conversationId: c.id,
      body: "Paid, thank you.",
      type: "payment_confirmation",
    });
    await repo.queueMessage(m.id);
    await repo.recordSendResult(m.id, {});
    await expect(repo.cancelMessage(m.id)).rejects.toThrow(/cannot be cancelled/i);
  });

  it("refuses outbound preparation on a closed thread", async () => {
    const repo = fresh();
    const c = await thread(repo);
    await repo.setConversationStatus(c.id, "closed");
    await expect(
      repo.prepareOutboundMessage({ conversationId: c.id, body: "hello" }),
    ).rejects.toThrow(/reopen/i);
  });

  it("emits approval and send events with no message body in the payload", async () => {
    const repo = fresh();
    const c = await thread(repo);
    const m = await repo.prepareOutboundMessage({
      conversationId: c.id,
      body: "Sensitive customer detail that must not leak.",
    });
    const spy = vi.spyOn(emitter, "emit");
    await repo.approveMessage(m.id);
    await repo.queueMessage(m.id);
    await repo.recordSendResult(m.id, { externalMessageId: "x" });
    const serialized = JSON.stringify(spy.mock.calls);
    expect(serialized).not.toContain("Sensitive customer detail");
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ type: COMMUNICATION_EVENTS.messageSent }),
    );
  });
});

describe("idempotency and external references", () => {
  it("returns the existing conversation for a repeated provider thread", async () => {
    const repo = fresh();
    const a = await repo.createConversation({
      customerId: "cust-1",
      channel: "email",
      integrationId: "int-1",
      externalThreadId: "thread-9",
    });
    const b = await repo.createConversation({
      customerId: "cust-1",
      channel: "email",
      integrationId: "int-1",
      externalThreadId: "thread-9",
    });
    expect(b.id).toBe(a.id);
    expect(await repo.listConversations()).toHaveLength(1);
    const found = await repo.findConversationByExternalThread(
      "int-1",
      "thread-9",
    );
    expect(found?.id).toBe(a.id);
  });

  it("deduplicates inbound messages by idempotency key", async () => {
    const repo = fresh();
    const c = await thread(repo);
    const first = await repo.recordInboundMessage({
      conversationId: c.id,
      body: "hello",
      idempotencyKey: "evt-1",
    });
    const retry = await repo.recordInboundMessage({
      conversationId: c.id,
      body: "hello",
      idempotencyKey: "evt-1",
    });
    expect(retry.id).toBe(first.id);
    expect(await repo.listMessages({ conversationId: c.id })).toHaveLength(1);
    expect(
      (await repo.findMessageByIdempotencyKey(c.id, "evt-1"))?.id,
    ).toBe(first.id);
  });

  it("deduplicates inbound messages by provider message id", async () => {
    const repo = fresh();
    const c = await thread(repo);
    const first = await repo.recordInboundMessage({
      conversationId: c.id,
      body: "hello",
      externalMessageId: "prov-1",
    });
    const retry = await repo.recordInboundMessage({
      conversationId: c.id,
      body: "hello again",
      externalMessageId: "prov-1",
    });
    expect(retry.id).toBe(first.id);
    expect((await repo.findMessageByExternalId("prov-1"))?.id).toBe(first.id);
  });

  it("deduplicates prepared outbound messages by idempotency key", async () => {
    const repo = fresh();
    const c = await thread(repo);
    const a = await repo.prepareOutboundMessage({
      conversationId: c.id,
      body: "Your quote is ready.",
      type: "quote_notification",
      idempotencyKey: "quote-1-notify",
    });
    const b = await repo.prepareOutboundMessage({
      conversationId: c.id,
      body: "Your quote is ready.",
      type: "quote_notification",
      idempotencyKey: "quote-1-notify",
    });
    expect(b.id).toBe(a.id);
  });
});

describe("service requests (intake)", () => {
  it("captures a request and flags missing information", async () => {
    const repo = fresh();
    const r = await repo.createServiceRequest({
      requestedService: "Brake pads",
      channel: "website",
    });
    expect(r.qualificationStatus).toBe("needs_info");
    expect(r.missingInformation).toContain("customerId");
    expect(r.missingInformation).toContain("vehicle");
  });

  it("is `new` when customer and vehicle description are present", async () => {
    const repo = fresh();
    const r = await repo.createServiceRequest({
      requestedService: "Oil change",
      channel: "phone",
      customerId: "cust-1",
      vehicleDescription: "2016 F-150",
    });
    expect(r.qualificationStatus).toBe("new");
    expect(r.missingInformation).toEqual([]);
  });

  it("rejects an empty requested service", async () => {
    const repo = fresh();
    await expect(
      repo.createServiceRequest({ requestedService: " ", channel: "website" }),
    ).rejects.toThrow(/requestedService/i);
  });

  it("emits a converted event when a request becomes a job", async () => {
    const repo = fresh();
    const r = await repo.createServiceRequest({
      requestedService: "Brakes",
      channel: "website",
      customerId: "cust-1",
      vehicleDescription: "F-150",
    });
    const spy = vi.spyOn(emitter, "emit");
    const next = await repo.updateServiceRequest(r.id, {
      qualificationStatus: "converted",
      jobId: "job-1",
    });
    expect(next.jobId).toBe("job-1");
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: COMMUNICATION_EVENTS.serviceRequestConverted,
      }),
    );
  });

  it("rejects an invalid qualification status", async () => {
    const repo = fresh();
    const r = await repo.createServiceRequest({
      requestedService: "Brakes",
      channel: "website",
    });
    await expect(
      repo.updateServiceRequest(r.id, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        qualificationStatus: "maybe" as any,
      }),
    ).rejects.toThrow(/invalid qualification status/i);
  });
});

describe("review requests", () => {
  it("deduplicates by customer and job so nobody is asked twice", async () => {
    const repo = fresh();
    const a = await repo.createReviewRequest({
      customerId: "cust-1",
      jobId: "job-1",
    });
    const b = await repo.createReviewRequest({
      customerId: "cust-1",
      jobId: "job-1",
    });
    expect(b.id).toBe(a.id);
    expect(await repo.listReviewRequests("cust-1")).toHaveLength(1);
    expect(a.status).toBe("eligible");
  });

  it("tracks status transitions", async () => {
    const repo = fresh();
    const r = await repo.createReviewRequest({ customerId: "cust-1" });
    const sent = await repo.setReviewRequestStatus(r.id, "sent");
    expect(sent.status).toBe("sent");
    expect(sent.sentAt).toBeDefined();
  });
});

describe("customer context read model", () => {
  it("aggregates threads, timings, and referenced entities without duplicating them", async () => {
    const repo = fresh();
    const c1 = await thread(repo);
    const c2 = await thread(repo, { subject: "Second" });
    await repo.linkEntity(c1.id, { type: "quote", id: "q-1" });
    await repo.recordInboundMessage({ conversationId: c1.id, body: "hi" });
    const m = await repo.prepareOutboundMessage({
      conversationId: c2.id,
      body: "Confirmed.",
      type: "appointment_confirmation",
    });
    await repo.queueMessage(m.id);
    await repo.recordSendResult(m.id, {});
    await repo.createServiceRequest({
      requestedService: "Brakes",
      channel: "website",
      customerId: "cust-1",
      vehicleDescription: "F-150",
    });
    await repo.createReviewRequest({ customerId: "cust-1", jobId: "job-1" });

    const ctx = await repo.getCustomerContext("cust-1");
    expect(ctx.conversationCount).toBe(2);
    expect(ctx.awaitingSkildConversationIds).toContain(c1.id);
    expect(ctx.awaitingCustomerConversationIds).toContain(c2.id);
    expect(ctx.lastInboundAt).toBeDefined();
    expect(ctx.lastOutboundAt).toBeDefined();
    expect(ctx.referencedEntities).toEqual([{ type: "quote", id: "q-1" }]);
    expect(ctx.serviceRequestIds).toHaveLength(1);
    expect(ctx.reviewRequestIds).toHaveLength(1);
  });
});

describe("stale conversation detection", () => {
  it("finds threads with no activity since a cutoff", async () => {
    const repo = fresh();
    const c = await thread(repo);
    await repo.recordInboundMessage({
      conversationId: c.id,
      body: "old",
      receivedAt: 1000,
    });
    const stale = await repo.listConversations({ inactiveSince: 5000 });
    expect(stale.map((x) => x.id)).toContain(c.id);
    const fresher = await repo.listConversations({ inactiveSince: 500 });
    expect(fresher).toHaveLength(0);
  });
});

describe("storage and registry", () => {
  it("persists across repository instances via versioned envelopes", async () => {
    const repo = fresh();
    const c = await thread(repo);
    await repo.recordInboundMessage({ conversationId: c.id, body: "hello" });

    const reopened = createLocalCommunicationRepository();
    const threads = await reopened.listConversations();
    expect(threads).toHaveLength(1);
    expect(threads[0].id).toBe(c.id);
    expect(await reopened.listMessages({ conversationId: c.id })).toHaveLength(1);
  });

  it("writes a schemaVersion envelope, not a bare array", async () => {
    const repo = fresh();
    await thread(repo);
    const raw = storage().getItem("skildos.communication.conversations.v1");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.schemaVersion).toBe(1);
    expect(Array.isArray(parsed.records)).toBe(true);
  });

  it("migrates a legacy bare array by backfilling refs", async () => {
    storage().clear();
    storage().setItem(
      "skildos.communication.conversations.v1",
      JSON.stringify([
        {
          id: "legacy-1",
          customerId: "cust-1",
          channel: "email",
          status: "open",
          awaitingParty: "none",
          createdAt: 1,
          updatedAt: 1,
          createdBy: "u",
        },
      ]),
    );
    const migrated = readEnvelope<{ id: string; refs: unknown[] }>(
      "skildos.communication.conversations.v1",
    );
    expect(migrated).toHaveLength(1);
    expect(migrated[0].refs).toEqual([]);
  });

  it("is resolvable and swappable through the Data Registry", async () => {
    const repo = fresh();
    registerRepository(COMMUNICATION_REPOSITORY, repo);
    const resolved = getRepository<CommunicationRepository>(
      COMMUNICATION_REPOSITORY,
    );
    expect(resolved).toBe(repo);

    const fake = { ...repo, listConversations: async () => [] };
    registerRepository(COMMUNICATION_REPOSITORY, fake);
    expect(
      getRepository<CommunicationRepository>(COMMUNICATION_REPOSITORY),
    ).toBe(fake);
  });

  it("notifies subscribers on mutation", async () => {
    const repo = fresh();
    let calls = 0;
    const unsub = repo.subscribe(() => {
      calls++;
    });
    const c = await thread(repo);
    await repo.recordInboundMessage({ conversationId: c.id, body: "x" });
    unsub();
    await repo.addInternalNote({ conversationId: c.id, body: "y" });
    expect(calls).toBe(2);
  });
});

describe("full lifecycle chain", () => {
  it("walks inquiry → request → quote → job → invoice → review with references only", async () => {
    const repo = fresh();
    registerRepository("crm.customerRepository", {
      get: async () => ({ id: "cust-1" }),
    });
    registerRepository("vehicles.vehicleRepository", {
      get: async () => ({ id: "veh-1" }),
    });
    registerRepository("quotes.repository", {
      getQuote: async () => ({ id: "q-1" }),
    });
    registerRepository("jobs.repository", { getJob: async () => ({ id: "j-1" }) });
    registerRepository("finance.repository", {
      getInvoice: async () => ({ id: "i-1" }),
    });

    const c = await repo.createConversation({
      customerId: "cust-1",
      vehicleId: "veh-1",
      channel: "website",
      source: "website.contact-form",
    });
    await repo.recordInboundMessage({
      conversationId: c.id,
      body: "Brakes squeal on my truck.",
    });
    const request = await repo.createServiceRequest({
      conversationId: c.id,
      customerId: "cust-1",
      vehicleId: "veh-1",
      requestedService: "Brake inspection",
      channel: "website",
    });
    expect(request.qualificationStatus).toBe("new");

    await repo.linkEntity(c.id, { type: "quote", id: "q-1" });
    await repo.updateServiceRequest(request.id, {
      qualificationStatus: "qualified",
      quoteId: "q-1",
    });

    const notify = await repo.prepareOutboundMessage({
      conversationId: c.id,
      body: "Your quote is ready to review.",
      type: "quote_notification",
      refs: [{ type: "quote", id: "q-1" }],
      idempotencyKey: "q-1:notify",
    });
    await repo.approveMessage(notify.id);
    await repo.queueMessage(notify.id);
    await repo.recordSendResult(notify.id, { externalMessageId: "p-1" });

    await repo.linkEntity(c.id, { type: "job", id: "j-1" });
    await repo.updateServiceRequest(request.id, {
      qualificationStatus: "converted",
      jobId: "j-1",
    });
    await repo.linkEntity(c.id, { type: "invoice", id: "i-1" });
    const review = await repo.createReviewRequest({
      customerId: "cust-1",
      jobId: "j-1",
      invoiceId: "i-1",
      conversationId: c.id,
    });

    const ctx = await repo.getCustomerContext("cust-1");
    expect(ctx.referencedEntities.map((r) => r.type).sort()).toEqual([
      "invoice",
      "job",
      "quote",
    ]);
    expect(ctx.reviewRequestIds).toEqual([review.id]);

    // Communication stores ids only — no money, no CRM field values.
    const stored = JSON.parse(
      storage().getItem("skildos.communication.conversations.v1")!,
    );
    expect(JSON.stringify(stored)).not.toMatch(/total|amount|price/i);
  });
});
