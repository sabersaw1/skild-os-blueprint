// Attention engine (Phase 12).
//
// Derives "things that may need Johnny" from real records only. Every item
// is computed on read from authoritative repositories — never stored — so it
// cannot drift from the truth. The only persisted part is the human's
// acknowledgement (see the assistant repository).
//
// The engine identifies and explains. It never acts.

import { formatCents } from "@/core/money";
import { ref, type JarvisTools } from "../tools";
import { fact } from "../context/resolver";
import type {
  AttentionAcknowledgement,
  AttentionItem,
  AttentionPriority,
  AttentionCategory,
  SourceRef,
} from "../data/schemas";

const DAY = 86_400_000;

export function attentionId(category: AttentionCategory, primaryId: string): string {
  return `att:${category}:${primaryId}`;
}

function make(
  category: AttentionCategory,
  primaryId: string,
  priority: AttentionPriority,
  title: string,
  reason: string,
  sources: SourceRef[],
  now: number,
  createdAt: number,
): AttentionItem {
  return {
    id: attentionId(category, primaryId),
    category,
    priority,
    title,
    reason,
    sources,
    evidence: [fact(reason, "system_derived", sources)],
    createdAt,
    status: "open",
  };
}

const PRIORITY_ORDER: Record<AttentionPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export async function buildAttentionItems(opts: {
  tools: JarvisTools;
  now?: number;
  acknowledgements?: AttentionAcknowledgement[];
  /** Include acknowledged/dismissed items in the result. Default false. */
  includeResolved?: boolean;
}): Promise<AttentionItem[]> {
  const { tools } = opts;
  const now = opts.now ?? Date.now();
  const acks = new Map((opts.acknowledgements ?? []).map((a) => [a.attentionId, a]));
  const items: AttentionItem[] = [];

  const safe = async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn();
    } catch {
      // A capability denial or missing repository simply removes that
      // category from the list. It never produces a speculative item.
      return undefined;
    }
  };

  const newLeads = await safe(() => tools.getNewLeads(now));
  for (const lead of newLeads ?? []) {
    items.push(
      make(
        "new_lead",
        lead.id,
        "high",
        `New lead: ${lead.serviceRequested ?? lead.channel}`,
        `Lead was created ${Math.floor((now - lead.createdAt) / 3_600_000)}h ago and has not been contacted.`,
        [ref("marketing", "lead", lead.id)],
        now,
        lead.createdAt,
      ),
    );
  }

  const stale = await safe(() => tools.getStaleLeads(now));
  for (const s of stale ?? []) {
    if (s.lead?.status === "new") continue; // already covered as new_lead
    items.push(
      make(
        "stale_lead",
        s.leadId,
        "high",
        `Lead needs follow-up`,
        `Untouched for ${Math.floor((now - s.lastTouchedAt) / DAY)} day(s): ${s.reasons.join(", ")}.`,
        [ref("marketing", "lead", s.leadId)],
        now,
        s.lastTouchedAt,
      ),
    );
  }

  const pendingComms = await safe(() => tools.getPendingCommunications());
  for (const conv of pendingComms ?? []) {
    items.push(
      make(
        "unanswered_communication",
        conv.id,
        "urgent",
        `Conversation awaiting a Skild reply`,
        `Thread on ${conv.channel} is marked awaiting Skild since ${new Date(conv.lastCustomerMessageAt ?? conv.updatedAt).toISOString().slice(0, 10)}.`,
        [ref("communication", "conversation", conv.id), ref("crm", "customer", conv.customerId)],
        now,
        conv.lastCustomerMessageAt ?? conv.updatedAt,
      ),
    );
  }

  const quotes = await safe(() => tools.getPendingQuotes());
  for (const q of quotes ?? []) {
    const days = Math.floor((now - q.updatedAt) / DAY);
    items.push(
      make(
        "quote_awaiting_response",
        q.id,
        days >= 3 ? "high" : "normal",
        `Quote awaiting response: ${q.title}`,
        `Sent ${days} day(s) ago with no recorded response.`,
        [ref("quotes", "quote", q.id), ref("crm", "customer", q.customerId)],
        now,
        q.updatedAt,
      ),
    );
  }

  const awaitingParts = await safe(() => tools.getJobsAwaitingParts());
  for (const j of awaitingParts ?? []) {
    items.push(
      make(
        "job_awaiting_parts",
        j.id,
        "high",
        `Job paused on parts: ${j.title}`,
        `Job is paused and its records mention parts.`,
        [ref("jobs", "job", j.id)],
        now,
        j.updatedAt,
      ),
    );
  }

  const conflicts = await safe(() => tools.getSchedulingConflicts());
  for (const conflict of conflicts ?? []) {
    items.push(
      make(
        "scheduling_conflict",
        `${conflict.a.id}+${conflict.b.id}`,
        "urgent",
        `Scheduling conflict for ${conflict.a.assignedTo}`,
        `"${conflict.a.title}" and "${conflict.b.title}" overlap for the same assignee.`,
        [ref("jobs", "job", conflict.a.id), ref("jobs", "job", conflict.b.id)],
        now,
        Math.max(conflict.a.updatedAt, conflict.b.updatedAt),
      ),
    );
  }

  const invoices = await safe(() => tools.getUnpaidInvoices());
  for (const i of invoices ?? []) {
    const overdue = i.dueAt !== undefined && i.dueAt < now;
    items.push(
      make(
        "unpaid_invoice",
        i.id,
        overdue ? "high" : "normal",
        `Unpaid invoice ${i.number}`,
        `${formatCents(i.balance)} outstanding${overdue ? " and past its due date" : ""}.`,
        [ref("finance", "invoice", i.id), ref("crm", "customer", i.customerId)],
        now,
        i.issuedAt ?? i.createdAt,
      ),
    );
  }

  const reviews = await safe(() => tools.getReviewOpportunities());
  for (const r of reviews ?? []) {
    items.push(
      make(
        "review_opportunity",
        r.job.id,
        "low",
        `No review request recorded for "${r.job.title}"`,
        `Job is completed and Communication holds no review request for it.`,
        [ref("jobs", "job", r.job.id), ref("crm", "customer", r.customerId)],
        now,
        r.job.updatedAt,
      ),
    );
  }

  const retention = await safe(() => tools.getRetentionOpportunities(now));
  for (const r of retention ?? []) {
    items.push(
      make(
        "retention_opportunity",
        r.customerId,
        "low",
        `Customer has no recent completed work`,
        `${r.daysSinceLastJob ?? "?"} day(s) since the last completed job: ${r.reasons.join(", ")}.`,
        [ref("crm", "customer", r.customerId)],
        now,
        r.lastJobAt ?? now,
      ),
    );
  }

  const opportunities = await safe(() => tools.getMarketingOpportunities());
  for (const o of opportunities ?? []) {
    if (o.status !== "identified" && o.status !== "reviewing") continue;
    items.push(
      make(
        "marketing_opportunity",
        o.id,
        "low",
        `Marketing opportunity: ${o.title}`,
        `Recorded from ${o.evidenceSource} evidence and awaiting a decision.`,
        [ref("marketing", "opportunity", o.id)],
        now,
        o.createdAt,
      ),
    );
  }

  const withStatus = items.map((item) => {
    const ack = acks.get(item.id);
    if (!ack) return item;
    return {
      ...item,
      status: ack.status,
      acknowledgedAt: ack.at,
      acknowledgedBy: ack.by,
    };
  });

  return withStatus
    .filter((i) => (opts.includeResolved ? true : i.status === "open"))
    .sort(
      (a, b) =>
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.createdAt - b.createdAt,
    );
}
