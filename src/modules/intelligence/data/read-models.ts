// Dataset loading for the BI read layer (Phase 14).
//
// This is the ONLY place in the Intelligence module that reaches other
// modules, and it does so exclusively through the Data Registry using each
// module's PUBLIC repository interface. It never imports a local repository,
// never touches storage, and never copies a source record into BI storage —
// the dataset lives for the duration of one calculation and is discarded.
//
// A module whose repository is not registered is recorded in
// `unavailableModules` so every downstream figure can declare its own
// completeness instead of silently reporting zero as fact.

import { getRepository, hasRepository } from "@/core/data/registry";
import {
  MARKETING_REPOSITORY,
  type MarketingRepository,
} from "@/modules/marketing/data/repository";
import { QUOTES_REPOSITORY, type QuotesRepository } from "@/modules/quotes/data/repository";
import { JOBS_REPOSITORY, type JobsRepository } from "@/modules/jobs/data/repository";
import { FINANCE_REPOSITORY, type FinanceRepository } from "@/modules/finance/data/repository";
import { PARTS_REPOSITORY, type PartsRepository } from "@/modules/parts/data/repository";
import type { LaborEntry } from "@/modules/jobs/data/schemas";
import type { Payment } from "@/modules/finance/data/schemas";
import { emptyDataset, type IntelligenceDataset } from "./calculations";
import type { Period } from "./schemas";

function optional<T>(key: string): T | undefined {
  return hasRepository(key) ? getRepository<T>(key) : undefined;
}

/**
 * Build a period-scoped dataset from the authoritative modules.
 *
 * Records are read WIDE (not pre-filtered to the period) because several
 * calculations legitimately need history outside the window — prior parts
 * cost, earlier completed jobs for repeat-customer rate, ageing quotes.
 * Period filtering happens inside the pure calculations.
 */
export async function loadDataset(
  period: Period,
  now = Date.now(),
): Promise<IntelligenceDataset> {
  const ds = emptyDataset(period, now);

  const marketing = optional<MarketingRepository>(MARKETING_REPOSITORY);
  if (marketing) ds.leads = await marketing.listLeads();
  else ds.unavailableModules.push("marketing");

  const quotes = optional<QuotesRepository>(QUOTES_REPOSITORY);
  if (quotes) ds.quotes = await quotes.listQuotes();
  else ds.unavailableModules.push("quotes");

  const jobs = optional<JobsRepository>(JOBS_REPOSITORY);
  if (jobs) {
    ds.jobs = await jobs.list();
    const laborByJob: Record<string, LaborEntry[]> = {};
    for (const job of ds.jobs) {
      laborByJob[job.id] = await jobs.listLabor(job.id);
    }
    ds.laborByJob = laborByJob;
  } else {
    ds.unavailableModules.push("jobs");
  }

  const finance = optional<FinanceRepository>(FINANCE_REPOSITORY);
  if (finance) {
    ds.invoices = await finance.listInvoices();
    const payments: Payment[] = [];
    for (const invoice of ds.invoices) {
      payments.push(...(await finance.listPayments(invoice.id)));
    }
    ds.payments = payments;
  } else {
    ds.unavailableModules.push("finance");
  }

  const parts = optional<PartsRepository>(PARTS_REPOSITORY);
  if (parts) ds.partsUsage = await parts.listUsage();
  else ds.unavailableModules.push("parts");

  return ds;
}

/** Convenience: the last `days` days ending now. */
export function lastDays(days: number, now = Date.now()): Period {
  return { start: now - days * 86_400_000, end: now };
}
