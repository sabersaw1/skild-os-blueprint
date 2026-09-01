// Deterministic intent classification (Phase 12).
//
// The model NEVER decides which data it may see. A question is classified
// here, by rules, into a structured intent; the intent then selects a fixed
// set of read-only tools. That is the whole point: the assistant reasons
// over a bounded slice of the OS instead of roaming the application.
//
// Unrecognised questions classify as "unknown" — which produces declared
// uncertainty downstream, never a fabricated answer.

import type { ClassifiedIntent, IntentType } from "../data/schemas";

interface Rule {
  type: IntentType;
  /** All groups must match at least one term (AND of ORs). */
  groups: string[][];
  weight: number;
}

const RULES: Rule[] = [
  { type: "brief.daily", groups: [["brief", "briefing", "good morning", "what is happening", "what's happening", "how is the business", "business overview"]], weight: 3 },
  { type: "operational.attention", groups: [["attention", "needs me", "need my", "important", "urgent", "what matters"]], weight: 3 },
  { type: "operational.today", groups: [["today", "todays", "today's"], ["job", "jobs", "schedule", "have", "booked"]], weight: 3 },
  { type: "operational.upcoming", groups: [["upcoming", "next", "tomorrow", "this week", "scheduled"], ["job", "jobs", "schedule", "work"]], weight: 2 },
  { type: "jobs.awaiting_parts", groups: [["waiting", "awaiting", "blocked"], ["part", "parts"]], weight: 4 },
  { type: "jobs.incomplete", groups: [["incomplete", "unfinished", "open", "in progress", "paused", "not finished"], ["job", "jobs", "work"]], weight: 3 },
  { type: "leads.follow_up", groups: [["follow up", "follow-up", "followup", "stale", "hasn't responded", "havent responded", "hasnt responded", "no response"], ["lead", "leads"]], weight: 4 },
  { type: "leads.new", groups: [["new", "came in", "recent", "fresh"], ["lead", "leads", "inquiry", "inquiries", "enquiry"]], weight: 3 },
  { type: "quotes.pending", groups: [["quote", "quotes", "estimate", "estimates"], ["waiting", "pending", "awaiting", "outstanding", "converted", "convert", "response", "open"]], weight: 4 },
  { type: "finance.unpaid", groups: [["invoice", "invoices"], ["unpaid", "outstanding", "owed", "owing", "overdue", "balance"]], weight: 4 },
  { type: "finance.revenue", groups: [["revenue", "income", "collected", "made", "paid us", "profit", "profitable"]], weight: 3 },
  { type: "parts.job_cost", groups: [["cost", "costs", "cost us", "spend", "spent", "parts used", "profit"], ["job", "repair", "part", "parts"]], weight: 3 },
  { type: "customer.history", groups: [["customer", "client"], ["history", "past", "previous", "record", "records", "show me"]], weight: 3 },
  { type: "vehicle.history", groups: [["vehicle", "truck", "car", "vin", "plate"], ["history", "work", "done", "service", "serviced"]], weight: 3 },
  { type: "marketing.opportunities", groups: [["marketing", "seo", "content", "reviews"], ["opportunity", "opportunities", "ideas", "should we"]], weight: 3 },
  { type: "marketing.performance", groups: [["marketing", "service", "services", "demand", "source", "sources", "channel"], ["performance", "generating", "working", "best", "converting", "demand"]], weight: 3 },
  { type: "knowledge.lookup", groups: [["policy", "sop", "procedure", "process", "rule", "rules", "standard", "how do we", "what is our"]], weight: 3 },
];

const HINT_STOPWORDS = new Set([
  "what", "which", "who", "how", "when", "where", "show", "me", "my", "the",
  "a", "an", "do", "does", "did", "is", "are", "was", "were", "have", "has",
  "i", "we", "our", "us", "on", "for", "of", "to", "in", "and", "this",
  "that", "today", "jobs", "job", "leads", "lead", "quotes", "quote",
  "invoices", "invoice", "parts", "part", "customer", "vehicle", "much",
  "many", "need", "needs", "waiting", "attention", "cost", "repair",
]);

function confidenceFor(score: number): ClassifiedIntent["confidence"] {
  if (score >= 4) return "high";
  if (score >= 3) return "medium";
  return "low";
}

export function classifyIntent(question: string): ClassifiedIntent {
  const q = ` ${question.toLowerCase().replace(/[^a-z0-9'\s-]/g, " ").replace(/\s+/g, " ")} `;

  let best: { rule: Rule; matched: string[] } | undefined;
  for (const rule of RULES) {
    const matched: string[] = [];
    let ok = true;
    for (const group of rule.groups) {
      const hit = group.find((term) => q.includes(` ${term} `) || q.includes(`${term} `) || q.includes(` ${term}`));
      if (!hit) {
        ok = false;
        break;
      }
      matched.push(hit);
    }
    if (!ok) continue;
    if (!best || rule.weight > best.rule.weight) best = { rule, matched };
  }

  const entityHints = q
    .trim()
    .split(" ")
    .filter((w) => w.length > 2 && !HINT_STOPWORDS.has(w))
    .slice(0, 8);

  if (!best) {
    return {
      type: "unknown",
      confidence: "low",
      matchedTerms: [],
      entityHints,
    };
  }

  return {
    type: best.rule.type,
    confidence: confidenceFor(best.rule.weight),
    matchedTerms: best.matched,
    entityHints,
  };
}
