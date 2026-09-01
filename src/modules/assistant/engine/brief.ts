// Daily brief foundation (Phase 12).
//
// Every line is a Fact derived from a real repository read. A section that
// cannot be read (capability or missing repository) is listed under
// `omitted` rather than filled with a zero — an unknown is never rendered
// as "nothing to do".

import { formatCents } from "@/core/money";
import { ref, type JarvisTools } from "../tools";
import { fact } from "../context/resolver";
import type { DailyBrief, DailyBriefSection, Fact } from "../data/schemas";

async function section(
  id: string,
  label: string,
  omitted: string[],
  build: () => Promise<Fact[]>,
): Promise<DailyBriefSection | undefined> {
  try {
    return { id, label, lines: await build() };
  } catch {
    omitted.push(label);
    return undefined;
  }
}

export async function buildDailyBrief(opts: {
  tools: JarvisTools;
  now?: number;
  attentionCount: number;
  displayName?: string;
}): Promise<DailyBrief> {
  const { tools, attentionCount } = opts;
  const now = opts.now ?? Date.now();
  const omitted: string[] = [];
  const sections: DailyBriefSection[] = [];

  const push = (s?: DailyBriefSection) => {
    if (s) sections.push(s);
  };

  push(
    await section("today", "Today", omitted, async () => {
      const jobs = await tools.getTodaySchedule(now);
      return [
        fact(
          `${jobs.length} job${jobs.length === 1 ? "" : "s"} scheduled`,
          "system_derived",
          jobs.map((j) => ref("jobs", "job", j.id)),
          { value: jobs.length, unit: "count" },
        ),
      ];
    }),
  );

  push(
    await section("leads", "Leads", omitted, async () => {
      const fresh = await tools.getNewLeads(now);
      const stale = await tools.getStaleLeads(now);
      return [
        fact(`${fresh.length} new`, "system_derived", fresh.map((l) => ref("marketing", "lead", l.id)), {
          value: fresh.length,
          unit: "count",
        }),
        fact(
          `${stale.length} needing attention`,
          "system_derived",
          stale.map((s) => ref("marketing", "lead", s.leadId)),
          { value: stale.length, unit: "count" },
        ),
      ];
    }),
  );

  push(
    await section("quotes", "Quotes", omitted, async () => {
      const pending = await tools.getPendingQuotes();
      return [
        fact(
          `${pending.length} awaiting response`,
          "system_derived",
          pending.map((q) => ref("quotes", "quote", q.id)),
          { value: pending.length, unit: "count" },
        ),
      ];
    }),
  );

  push(
    await section("parts", "Parts", omitted, async () => {
      const jobs = await tools.getJobsAwaitingParts();
      return [
        fact(
          `${jobs.length} job${jobs.length === 1 ? "" : "s"} paused on parts`,
          "system_derived",
          jobs.map((j) => ref("jobs", "job", j.id)),
          { value: jobs.length, unit: "count" },
        ),
      ];
    }),
  );

  push(
    await section("finance", "Finance", omitted, async () => {
      const invoices = await tools.getUnpaidInvoices();
      const balance = invoices.reduce((s, i) => s + i.balance, 0);
      return [
        fact(
          `${invoices.length} unpaid invoice${invoices.length === 1 ? "" : "s"} (${formatCents(balance)})`,
          "system_derived",
          invoices.map((i) => ref("finance", "invoice", i.id)),
          { value: balance, unit: "cents" },
        ),
      ];
    }),
  );

  const name = opts.displayName?.trim();
  return {
    generatedAt: now,
    greeting: name ? `Good morning, ${name}` : "Good morning",
    sections,
    attentionCount,
    omitted,
  };
}
