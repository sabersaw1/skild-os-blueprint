// Recommendation engine (Phase 12).
//
// A recommendation is an INTERPRETATION, never a fact. Each one is derived
// from attention items that were themselves derived from real records, and
// each carries its reason, its basis facts, and the source ids behind it.
//
// Recommendations mutate nothing. They are produced on read and discarded
// when the answer is discarded.

import { newId } from "@/core/ids";
import type {
  AttentionItem,
  Confidence,
  ProposalActionType,
  Recommendation,
} from "../data/schemas";

interface Mapping {
  title: (item: AttentionItem) => string;
  proposal?: ProposalActionType;
  confidence: Confidence;
}

const MAPPINGS: Partial<Record<AttentionItem["category"], Mapping>> = {
  new_lead: {
    title: () => "Respond to this new lead",
    proposal: "follow_up_lead",
    confidence: "high",
  },
  stale_lead: {
    title: () => "Follow up with this lead",
    proposal: "follow_up_lead",
    confidence: "high",
  },
  unanswered_communication: {
    title: () => "Reply to this conversation",
    proposal: "follow_up_lead",
    confidence: "high",
  },
  quote_awaiting_response: {
    title: () => "Follow up on this quote",
    proposal: "follow_up_quote",
    confidence: "medium",
  },
  job_awaiting_parts: {
    title: () => "Check the parts order for this job",
    proposal: "order_parts",
    confidence: "medium",
  },
  scheduling_conflict: {
    title: () => "Resolve this scheduling overlap",
    proposal: "schedule_job",
    confidence: "high",
  },
  unpaid_invoice: {
    title: () => "Chase this unpaid invoice",
    proposal: "invoice_reminder",
    confidence: "medium",
  },
  review_opportunity: {
    title: () => "Ask this customer for a review",
    proposal: "request_review",
    confidence: "medium",
  },
  retention_opportunity: {
    title: () => "Consider a retention check-in",
    proposal: "retention_outreach",
    confidence: "low",
  },
  marketing_opportunity: {
    title: (i) => `Decide on: ${i.title}`,
    confidence: "low",
  },
};

export function recommendationsFromAttention(
  items: AttentionItem[],
  opts: { now?: number; limit?: number } = {},
): Recommendation[] {
  const now = opts.now ?? Date.now();
  const limit = opts.limit ?? 8;
  const out: Recommendation[] = [];

  for (const item of items) {
    const mapping = MAPPINGS[item.category];
    if (!mapping) continue;
    out.push({
      id: newId(),
      title: mapping.title(item),
      reason: item.reason,
      confidence: mapping.confidence,
      basis: item.evidence,
      sources: item.sources,
      suggestedProposalType: mapping.proposal,
      createdAt: now,
    });
    if (out.length >= limit) break;
  }

  return out;
}
