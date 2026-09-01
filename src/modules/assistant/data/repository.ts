// Assistant repository — public interface only.
//
// Jarvis owns exactly TWO durable record types, and neither duplicates a
// business record:
//   1. AI action proposals — what Jarvis thinks should happen, never done.
//   2. Attention acknowledgements — a human's decision about a derived item.
//
// Everything else Jarvis knows is read live from the owning module through
// the Data Registry.

import type {
  AiActionProposal,
  AttentionAcknowledgement,
  AttentionStatus,
  ProposalCreateInput,
  ProposalListQuery,
} from "./schemas";

export const ASSISTANT_REPOSITORY = "assistant.repository";

export interface AssistantRepository {
  // ---- AI action proposals ---------------------------------------------
  listProposals(query?: ProposalListQuery): Promise<AiActionProposal[]>;
  getProposal(id: string): Promise<AiActionProposal | undefined>;
  /**
   * Record a proposal. Recording is NOT execution: the proposal is created
   * with approval "pending" and execution "not_executed", always.
   */
  createProposal(input: ProposalCreateInput): Promise<AiActionProposal>;
  approveProposal(id: string, approvedBy?: string): Promise<AiActionProposal>;
  rejectProposal(id: string, reason?: string): Promise<AiActionProposal>;
  /**
   * Record that a HUMAN carried the action out. Phase 12 performs no
   * outbound action of any kind; this only writes history.
   */
  markProposalExecutedByHuman(id: string, note?: string): Promise<AiActionProposal>;
  /** Mark pending proposals past their expiry. Pure bookkeeping. */
  expireProposals(now?: number): Promise<AiActionProposal[]>;

  // ---- Attention acknowledgements ---------------------------------------
  listAcknowledgements(): Promise<AttentionAcknowledgement[]>;
  setAttentionStatus(
    attentionId: string,
    status: Exclude<AttentionStatus, "open">,
    note?: string,
  ): Promise<AttentionAcknowledgement>;

  /** Subscribe to any change; consumers use this to refresh. */
  subscribe(listener: () => void): () => void;
}
