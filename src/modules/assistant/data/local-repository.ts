// Local implementation of AssistantRepository.
// Repository implementations are the ONLY place allowed to touch storage.
//
// Storage keys (versioned envelopes — see ./storage.ts):
//   skildos.assistant.proposals.v1
//   skildos.assistant.attentionAcks.v1
//
// Mutation ordering rule: validate → persist → emit → return.
// A validation failure must leave storage untouched and emit NO event.
//
// PHASE 12 BOUNDARY: nothing here sends, publishes, spends, schedules, or
// contacts anyone. A proposal is a durable *suggestion*; the only execution
// state it can ever reach is "executed_by_human", recorded after the fact.

import { newId } from "@/core/ids";
import { getIdentity } from "@/core/auth/identity";
import { emit } from "@/core/activity/emitter";
import { ASSISTANT_EVENTS } from "../activity";
import {
  PROPOSAL_ACTION_TYPES,
  PROPOSAL_MINIMUM_RISK,
  PROPOSAL_REQUIRED_CAPABILITY,
  type AiActionProposal,
  type AttentionAcknowledgement,
  type AttentionStatus,
  type ProposalCreateInput,
  type ProposalListQuery,
  type ProposalRisk,
} from "./schemas";
import type { AssistantRepository } from "./repository";
import { readEnvelope, registerVersionedKey, writeEnvelope } from "./storage";
import { assertPersisted } from "@/core/storage/persistence";

const K_PROPOSALS = "skildos.assistant.proposals.v1";
const K_ACKS = "skildos.assistant.attentionAcks.v1";

registerVersionedKey<AiActionProposal>({
  key: K_PROPOSALS,
  currentVersion: 1,
  migrations: {
    0: (records) =>
      (records as AiActionProposal[]).map((p) => ({
        ...p,
        evidence: p.evidence ?? [],
        providerId: p.providerId ?? "deterministic",
        execution: p.execution ?? "not_executed",
      })),
  },
});

registerVersionedKey<AttentionAcknowledgement>({
  key: K_ACKS,
  currentVersion: 1,
  migrations: { 0: (records) => records as AttentionAcknowledgement[] },
});

const RISK_ORDER: Record<ProposalRisk, number> = { low: 0, medium: 1, high: 2 };

function maxRisk(a: ProposalRisk, b: ProposalRisk): ProposalRisk {
  return RISK_ORDER[a] >= RISK_ORDER[b] ? a : b;
}

export class LocalAssistantRepository implements AssistantRepository {
  private listeners = new Set<() => void>();

  // ---- storage ----------------------------------------------------------
  private readProposals(): AiActionProposal[] {
    return readEnvelope<AiActionProposal>(K_PROPOSALS);
  }

  private writeProposals(rows: AiActionProposal[]): void {
    assertPersisted(K_PROPOSALS, writeEnvelope(K_PROPOSALS, rows));
    this.notify();
  }

  private readAcks(): AttentionAcknowledgement[] {
    return readEnvelope<AttentionAcknowledgement>(K_ACKS);
  }

  private writeAcks(rows: AttentionAcknowledgement[]): void {
    assertPersisted(K_ACKS, writeEnvelope(K_ACKS, rows));
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach((l) => l());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ---- proposals --------------------------------------------------------
  async listProposals(query: ProposalListQuery = {}): Promise<AiActionProposal[]> {
    let rows = this.readProposals();
    if (query.actionType) rows = rows.filter((p) => p.actionType === query.actionType);
    if (query.approval) rows = rows.filter((p) => p.approval === query.approval);
    if (query.execution) rows = rows.filter((p) => p.execution === query.execution);
    if (query.risk) rows = rows.filter((p) => p.risk === query.risk);
    rows = rows.sort((a, b) => b.generatedAt - a.generatedAt);
    return query.limit ? rows.slice(0, query.limit) : rows;
  }

  async getProposal(id: string): Promise<AiActionProposal | undefined> {
    return this.readProposals().find((p) => p.id === id);
  }

  async createProposal(input: ProposalCreateInput): Promise<AiActionProposal> {
    // validate
    if (!PROPOSAL_ACTION_TYPES.includes(input.actionType)) {
      throw new Error(`Assistant: unknown proposal action type "${input.actionType}".`);
    }
    const title = input.title?.trim();
    if (!title) throw new Error("Assistant: a proposal requires a title.");
    const reason = input.reason?.trim();
    if (!reason) {
      throw new Error("Assistant: a proposal requires a reason — a suggestion without a stated basis is never recorded.");
    }
    if (!input.targets?.length) {
      throw new Error("Assistant: a proposal requires at least one target record reference.");
    }
    for (const t of input.targets) {
      if (!t.module || !t.entity || !t.id) {
        throw new Error("Assistant: every proposal target needs module, entity, and id.");
      }
    }

    const now = Date.now();
    const proposal: AiActionProposal = {
      id: newId(),
      actionType: input.actionType,
      title,
      targets: [...input.targets],
      reason,
      evidence: input.evidence ?? [],
      // Risk can be raised above the floor but never lowered below it.
      risk: maxRisk(input.risk ?? "low", PROPOSAL_MINIMUM_RISK[input.actionType]),
      requiredCapabilityId: PROPOSAL_REQUIRED_CAPABILITY[input.actionType],
      approval: "pending",
      execution: "not_executed",
      generatedAt: now,
      updatedAt: now,
      generatedBy: getIdentity().id,
      providerId: input.providerId ?? "deterministic",
      expiresAt: input.expiresAt,
      recommendationId: input.recommendationId,
    };

    // persist
    this.writeProposals([...this.readProposals(), proposal]);

    // emit
    emit({
      type: ASSISTANT_EVENTS.proposalCreated,
      moduleId: "assistant",
      summary: `Jarvis proposed: ${proposal.title}`,
      payload: {
        proposalId: proposal.id,
        actionType: proposal.actionType,
        risk: proposal.risk,
        requiredCapabilityId: proposal.requiredCapabilityId,
        targetCount: proposal.targets.length,
      },
    });

    return proposal;
  }

  private async transition(
    id: string,
    mutate: (p: AiActionProposal) => AiActionProposal,
  ): Promise<AiActionProposal> {
    const rows = this.readProposals();
    const idx = rows.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`Assistant: no proposal with id "${id}".`);
    const next = mutate(rows[idx]!);
    const copy = [...rows];
    copy[idx] = next;
    this.writeProposals(copy);
    return next;
  }

  async approveProposal(id: string, approvedBy?: string): Promise<AiActionProposal> {
    const current = await this.getProposal(id);
    if (!current) throw new Error(`Assistant: no proposal with id "${id}".`);
    if (current.approval !== "pending") {
      throw new Error(
        `Assistant: proposal is "${current.approval}" and can no longer be approved.`,
      );
    }
    const now = Date.now();
    const next = await this.transition(id, (p) => ({
      ...p,
      approval: "approved",
      decidedAt: now,
      decidedBy: approvedBy ?? getIdentity().id,
      updatedAt: now,
    }));
    emit({
      type: ASSISTANT_EVENTS.proposalApproved,
      moduleId: "assistant",
      summary: `Approved Jarvis proposal: ${next.title}`,
      payload: {
        proposalId: next.id,
        actionType: next.actionType,
        risk: next.risk,
        requiredCapabilityId: next.requiredCapabilityId,
      },
    });
    return next;
  }

  async rejectProposal(id: string, reason?: string): Promise<AiActionProposal> {
    const current = await this.getProposal(id);
    if (!current) throw new Error(`Assistant: no proposal with id "${id}".`);
    if (current.approval !== "pending") {
      throw new Error(
        `Assistant: proposal is "${current.approval}" and can no longer be rejected.`,
      );
    }
    const now = Date.now();
    const next = await this.transition(id, (p) => ({
      ...p,
      approval: "rejected",
      decidedAt: now,
      decidedBy: getIdentity().id,
      rejectedReason: reason?.trim() || undefined,
      updatedAt: now,
    }));
    emit({
      type: ASSISTANT_EVENTS.proposalRejected,
      moduleId: "assistant",
      summary: `Rejected Jarvis proposal: ${next.title}`,
      payload: { proposalId: next.id, actionType: next.actionType },
    });
    return next;
  }

  async markProposalExecutedByHuman(
    id: string,
    note?: string,
  ): Promise<AiActionProposal> {
    const current = await this.getProposal(id);
    if (!current) throw new Error(`Assistant: no proposal with id "${id}".`);
    if (current.approval !== "approved") {
      throw new Error(
        "Assistant: only an approved proposal can be recorded as carried out.",
      );
    }
    if (current.execution !== "not_executed") {
      throw new Error("Assistant: this proposal is already recorded as carried out.");
    }
    const now = Date.now();
    const next = await this.transition(id, (p) => ({
      ...p,
      execution: "executed_by_human",
      executedAt: now,
      executionNote: note?.trim() || undefined,
      updatedAt: now,
    }));
    emit({
      type: ASSISTANT_EVENTS.proposalExecuted,
      moduleId: "assistant",
      summary: `Recorded as done by a person: ${next.title}`,
      payload: { proposalId: next.id, actionType: next.actionType },
    });
    return next;
  }

  async expireProposals(now: number = Date.now()): Promise<AiActionProposal[]> {
    const rows = this.readProposals();
    const expired: AiActionProposal[] = [];
    const copy = rows.map((p) => {
      if (
        p.approval === "pending" &&
        p.expiresAt !== undefined &&
        p.expiresAt <= now
      ) {
        const next: AiActionProposal = { ...p, approval: "expired", updatedAt: now };
        expired.push(next);
        return next;
      }
      return p;
    });
    if (!expired.length) return [];
    this.writeProposals(copy);
    for (const p of expired) {
      emit({
        type: ASSISTANT_EVENTS.proposalExpired,
        moduleId: "assistant",
        summary: `Jarvis proposal expired: ${p.title}`,
        payload: { proposalId: p.id, actionType: p.actionType },
      });
    }
    return expired;
  }

  // ---- attention acknowledgements ---------------------------------------
  async listAcknowledgements(): Promise<AttentionAcknowledgement[]> {
    return this.readAcks();
  }

  async setAttentionStatus(
    attentionId: string,
    status: Exclude<AttentionStatus, "open">,
    note?: string,
  ): Promise<AttentionAcknowledgement> {
    if (!attentionId?.trim()) {
      throw new Error("Assistant: an attention id is required.");
    }
    if (status !== "acknowledged" && status !== "dismissed") {
      throw new Error(`Assistant: unsupported attention status "${status}".`);
    }
    const record: AttentionAcknowledgement = {
      attentionId,
      status,
      at: Date.now(),
      by: getIdentity().id,
      note: note?.trim() || undefined,
    };
    const rows = this.readAcks().filter((a) => a.attentionId !== attentionId);
    this.writeAcks([...rows, record]);
    emit({
      type:
        status === "dismissed"
          ? ASSISTANT_EVENTS.attentionDismissed
          : ASSISTANT_EVENTS.attentionAcknowledged,
      moduleId: "assistant",
      summary: `Attention item ${status}`,
      payload: { attentionId, status },
    });
    return record;
  }
}
