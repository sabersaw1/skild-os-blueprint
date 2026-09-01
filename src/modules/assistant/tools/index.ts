// Read-only Jarvis tools (Phase 12).
//
// RULES
//  1. Every tool is READ-ONLY. No tool in this file mutates a record.
//  2. Every tool reaches its data through the Data Registry, never through
//     a concrete repository import and never through storage.
//  3. Every tool declares the capability it needs. A caller without it gets
//     a CapabilityDeniedError, which the service turns into a declared
//     limitation — never into a guessed answer.
//  4. A missing repository is a RepositoryUnavailableError, which becomes
//     declared uncertainty. A tool NEVER fabricates a record.

import { laborTotalCents } from "@/core/money";
import { getRepository, hasRepository } from "@/core/data/registry";
import {
  CRM_CUSTOMER_REPOSITORY,
  type Customer,
  type CustomerRepository,
} from "@/modules/crm/data/repository";
import {
  VEHICLES_REPOSITORY,
  type Vehicle,
  type VehicleRepository,
} from "@/modules/vehicles/data/repository";
import { JOBS_REPOSITORY, type JobsRepository } from "@/modules/jobs/data/repository";
import type { Job, LaborEntry } from "@/modules/jobs/data/schemas";
import { QUOTES_REPOSITORY, type QuotesRepository } from "@/modules/quotes/data/repository";
import type { Quote } from "@/modules/quotes/data/schemas";
import { FINANCE_REPOSITORY, type FinanceRepository } from "@/modules/finance/data/repository";
import type { Invoice } from "@/modules/finance/data/schemas";
import { PARTS_REPOSITORY, type PartsRepository } from "@/modules/parts/data/repository";
import type { Part, PartUsage, Purchase } from "@/modules/parts/data/schemas";
import {
  COMMUNICATION_REPOSITORY,
  type CommunicationRepository,
} from "@/modules/communication/data/repository";
import type { Conversation } from "@/modules/communication/data/schemas";
import { MARKETING_REPOSITORY, type MarketingRepository } from "@/modules/marketing/data/repository";
import type {
  Lead,
  LeadAttentionItem,
  MarketingOpportunity,
  RetentionOpportunity,
  ServicePerformance,
  SourcePerformance,
} from "@/modules/marketing/data/schemas";
import { KNOWLEDGE_REPOSITORY, type KnowledgeRepository } from "@/modules/knowledge/data/repository";
import {
  AUTOMATION_REPOSITORY,
  type AutomationRepository,
} from "@/modules/automation/data/repository";
import type {
  AgentAction,
  AgentRun,
  AutomationOverview,
} from "@/modules/automation/data/schemas";
import type { KnowledgeDocument } from "@/modules/knowledge/data/schemas";
import type { SourceRef } from "../data/schemas";

export class CapabilityDeniedError extends Error {
  constructor(public readonly capabilityId: string) {
    super(`Jarvis: capability "${capabilityId}" is required for this data.`);
    this.name = "CapabilityDeniedError";
  }
}

export class RepositoryUnavailableError extends Error {
  constructor(public readonly repositoryKey: string) {
    super(`Jarvis: repository "${repositoryKey}" is not registered.`);
    this.name = "RepositoryUnavailableError";
  }
}

export type CapabilityCheck = (capabilityId: string) => boolean;

export const DAY_MS = 24 * 60 * 60 * 1000;

export function ref(module: string, entity: string, id: string): SourceRef {
  return { module, entity, id };
}

export interface JarvisToolMeta {
  name: string;
  description: string;
  requiredCapabilityId: string;
  repositoryKey: string;
}

/** Declarative catalogue — used by the UI and by future Phase 13 agents. */
export const JARVIS_TOOL_CATALOGUE: JarvisToolMeta[] = [
  { name: "getTodaySchedule", description: "Jobs scheduled to start today.", requiredCapabilityId: "jobs.read", repositoryKey: JOBS_REPOSITORY },
  { name: "getUpcomingJobs", description: "Jobs scheduled after today.", requiredCapabilityId: "jobs.read", repositoryKey: JOBS_REPOSITORY },
  { name: "getIncompleteJobs", description: "Jobs not yet completed or cancelled.", requiredCapabilityId: "jobs.read", repositoryKey: JOBS_REPOSITORY },
  { name: "getJobsAwaitingParts", description: "Paused jobs whose notes record a parts wait.", requiredCapabilityId: "jobs.read", repositoryKey: JOBS_REPOSITORY },
  { name: "getSchedulingConflicts", description: "Jobs with overlapping scheduled windows for the same assignee.", requiredCapabilityId: "jobs.read", repositoryKey: JOBS_REPOSITORY },
  { name: "getJobCost", description: "Recorded parts cost and labor for one job.", requiredCapabilityId: "jobs.read", repositoryKey: JOBS_REPOSITORY },
  { name: "getPartsUsed", description: "Parts usage recorded against a job.", requiredCapabilityId: "parts.read", repositoryKey: PARTS_REPOSITORY },
  { name: "getRecentPurchases", description: "Recently recorded parts purchases.", requiredCapabilityId: "parts.read", repositoryKey: PARTS_REPOSITORY },
  { name: "getNewLeads", description: "Leads created within a recent window.", requiredCapabilityId: "leads.read", repositoryKey: MARKETING_REPOSITORY },
  { name: "getStaleLeads", description: "Leads the Marketing module reports as needing attention.", requiredCapabilityId: "leads.read", repositoryKey: MARKETING_REPOSITORY },
  { name: "getPendingQuotes", description: "Quotes sent and awaiting a customer response.", requiredCapabilityId: "quotes.read", repositoryKey: QUOTES_REPOSITORY },
  { name: "getUnpaidInvoices", description: "Issued invoices with a remaining balance.", requiredCapabilityId: "finance.read", repositoryKey: FINANCE_REPOSITORY },
  { name: "getCollectedRevenue", description: "Sum of recorded payments across invoices.", requiredCapabilityId: "finance.read", repositoryKey: FINANCE_REPOSITORY },
  { name: "getPendingCommunications", description: "Conversations awaiting a Skild reply.", requiredCapabilityId: "communication.read", repositoryKey: COMMUNICATION_REPOSITORY },
  { name: "getReviewOpportunities", description: "Completed jobs with no review request recorded.", requiredCapabilityId: "communication.read", repositoryKey: COMMUNICATION_REPOSITORY },
  { name: "getCustomerHistory", description: "One customer's vehicles, jobs, quotes and invoices, by id.", requiredCapabilityId: "customers.read", repositoryKey: CRM_CUSTOMER_REPOSITORY },
  { name: "getVehicleHistory", description: "One vehicle's jobs, inspections references and parts usage.", requiredCapabilityId: "vehicles.read", repositoryKey: VEHICLES_REPOSITORY },
  { name: "searchKnowledge", description: "Search approved business knowledge documents.", requiredCapabilityId: "knowledge.read", repositoryKey: KNOWLEDGE_REPOSITORY },
  { name: "getMarketingPerformance", description: "Measured source and service performance.", requiredCapabilityId: "marketing.read", repositoryKey: MARKETING_REPOSITORY },
  { name: "getMarketingOpportunities", description: "Recorded marketing opportunities awaiting review.", requiredCapabilityId: "marketing.read", repositoryKey: MARKETING_REPOSITORY },
  { name: "getRetentionOpportunities", description: "Previous customers with no recent completed work.", requiredCapabilityId: "marketing.read", repositoryKey: MARKETING_REPOSITORY },
  { name: "getAutomationOverview", description: "Counts of active agents, pending approvals, blocked actions and failed runs.", requiredCapabilityId: "agents.read", repositoryKey: AUTOMATION_REPOSITORY },
  { name: "getRecentAgentRuns", description: "Recent agent runs and their outcomes, including failures.", requiredCapabilityId: "agents.read", repositoryKey: AUTOMATION_REPOSITORY },
  { name: "getActionsAwaitingApproval", description: "Agent actions waiting on a human decision.", requiredCapabilityId: "agents.read", repositoryKey: AUTOMATION_REPOSITORY },
];

function startOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface JobCostBreakdown {
  jobId: string;
  /** Integer cents, from Parts usage records. */
  partsCostCents: number;
  /** Labor is stored by the Jobs module in currency units, not cents. */
  laborHours: number;
  /** Labor amount in INTEGER CENTS. */
  laborAmountCents: number;
  usageCount: number;
  laborEntries: LaborEntry[];
  /** Integer cents, from issued invoices linked to this job. */
  invoicedTotalCents?: number;
}

export interface CustomerHistory {
  customer: Customer;
  vehicles: Vehicle[];
  jobs: Job[];
  quotes: Quote[];
  invoices: Invoice[];
}

export interface VehicleHistory {
  vehicle: Vehicle;
  jobs: Job[];
  quotes: Quote[];
  partsUsage: PartUsage[];
}

export interface JarvisTools {
  getTodaySchedule(now?: number): Promise<Job[]>;
  getUpcomingJobs(now?: number, days?: number): Promise<Job[]>;
  getIncompleteJobs(): Promise<Job[]>;
  getJobsAwaitingParts(): Promise<Job[]>;
  getSchedulingConflicts(): Promise<Array<{ a: Job; b: Job }>>;
  getJobCost(jobId: string): Promise<JobCostBreakdown | undefined>;
  getPartsUsed(jobId: string): Promise<Array<PartUsage & { part?: Part }>>;
  getRecentPurchases(limit?: number): Promise<Purchase[]>;
  getNewLeads(now?: number, withinMs?: number): Promise<Lead[]>;
  getStaleLeads(now?: number): Promise<Array<LeadAttentionItem & { lead?: Lead }>>;
  getPendingQuotes(): Promise<Quote[]>;
  getUnpaidInvoices(): Promise<Invoice[]>;
  getCollectedRevenue(): Promise<{ collectedCents: number; outstandingCents: number; invoiceCount: number }>;
  getPendingCommunications(): Promise<Conversation[]>;
  getReviewOpportunities(): Promise<Array<{ job: Job; customerId: string }>>;
  getCustomerHistory(customerId: string): Promise<CustomerHistory | undefined>;
  getVehicleHistory(vehicleId: string): Promise<VehicleHistory | undefined>;
  searchKnowledge(term: string, limit?: number): Promise<KnowledgeDocument[]>;
  getMarketingPerformance(): Promise<{ sources: SourcePerformance[]; services: ServicePerformance[] }>;
  getMarketingOpportunities(): Promise<MarketingOpportunity[]>;
  getRetentionOpportunities(now?: number): Promise<RetentionOpportunity[]>;
  // Automation (Phase 13) — READ ONLY, like every other tool here. Jarvis
  // can report what the agents did and what is waiting on a human; it can
  // neither start a run nor approve an action.
  getAutomationOverview(now?: number): Promise<AutomationOverview>;
  getRecentAgentRuns(limit?: number): Promise<AgentRun[]>;
  getActionsAwaitingApproval(): Promise<AgentAction[]>;
}

export function createJarvisTools(can: CapabilityCheck): JarvisTools {
  function need<T>(capabilityId: string, key: string): T {
    if (!can(capabilityId)) throw new CapabilityDeniedError(capabilityId);
    if (!hasRepository(key)) throw new RepositoryUnavailableError(key);
    return getRepository<T>(key);
  }

  const jobs = () => need<JobsRepository>("jobs.read", JOBS_REPOSITORY);
  const parts = () => need<PartsRepository>("parts.read", PARTS_REPOSITORY);
  const quotes = () => need<QuotesRepository>("quotes.read", QUOTES_REPOSITORY);
  const finance = () => need<FinanceRepository>("finance.read", FINANCE_REPOSITORY);
  const comms = () => need<CommunicationRepository>("communication.read", COMMUNICATION_REPOSITORY);
  const leadsRepo = () => need<MarketingRepository>("leads.read", MARKETING_REPOSITORY);
  const marketing = () => need<MarketingRepository>("marketing.read", MARKETING_REPOSITORY);
  const knowledge = () => need<KnowledgeRepository>("knowledge.read", KNOWLEDGE_REPOSITORY);
  const customers = () => need<CustomerRepository>("customers.read", CRM_CUSTOMER_REPOSITORY);
  const vehicles = () => need<VehicleRepository>("vehicles.read", VEHICLES_REPOSITORY);
  const automation = () =>
    need<AutomationRepository>("agents.read", AUTOMATION_REPOSITORY);

  return {
    async getTodaySchedule(now = Date.now()) {
      const from = startOfDay(now);
      const to = from + DAY_MS;
      const all = await jobs().list();
      return all
        .filter(
          (j) =>
            j.scheduledStart !== undefined &&
            j.scheduledStart >= from &&
            j.scheduledStart < to &&
            j.status !== "cancelled",
        )
        .sort((a, b) => (a.scheduledStart ?? 0) - (b.scheduledStart ?? 0));
    },

    async getUpcomingJobs(now = Date.now(), days = 7) {
      const from = startOfDay(now) + DAY_MS;
      const to = from + days * DAY_MS;
      const all = await jobs().list();
      return all
        .filter(
          (j) =>
            j.scheduledStart !== undefined &&
            j.scheduledStart >= from &&
            j.scheduledStart < to &&
            j.status !== "cancelled",
        )
        .sort((a, b) => (a.scheduledStart ?? 0) - (b.scheduledStart ?? 0));
    },

    async getIncompleteJobs() {
      const all = await jobs().list();
      return all.filter(
        (j) => j.status !== "completed" && j.status !== "cancelled" && j.status !== "draft",
      );
    },

    async getJobsAwaitingParts() {
      const all = await jobs().list();
      // Derived from what the Jobs module actually records: a paused job whose
      // reason/notes mention parts. Jarvis invents no "awaiting parts" state.
      const mentionsParts = (text: string) => /\bpart(s)?\b/i.test(text);
      const result: Job[] = [];
      for (const job of all) {
        if (job.status !== "paused") continue;
        if (mentionsParts(job.notes) || mentionsParts(job.description)) {
          result.push(job);
          continue;
        }
        const history = await jobs().listStatusHistory(job.id);
        const lastPause = [...history].reverse().find((h) => h.toStatus === "paused");
        if (lastPause?.reason && mentionsParts(lastPause.reason)) result.push(job);
      }
      return result;
    },

    async getSchedulingConflicts() {
      const all = await jobs().list();
      const scheduled = all.filter(
        (j) =>
          j.scheduledStart !== undefined &&
          j.scheduledEnd !== undefined &&
          j.status !== "cancelled" &&
          j.status !== "completed",
      );
      const conflicts: Array<{ a: Job; b: Job }> = [];
      for (let i = 0; i < scheduled.length; i++) {
        for (let k = i + 1; k < scheduled.length; k++) {
          const a = scheduled[i];
          const b = scheduled[k];
          if (!a.assignedTo || !b.assignedTo) continue;
          if (a.assignedTo !== b.assignedTo) continue;
          if (a.scheduledStart! < b.scheduledEnd! && b.scheduledStart! < a.scheduledEnd!) {
            conflicts.push({ a, b });
          }
        }
      }
      return conflicts;
    },

    async getJobCost(jobId: string) {
      const job = await jobs().get(jobId);
      if (!job) return undefined;
      const laborEntries = await jobs().listLabor(jobId);
      const laborHours = laborEntries.reduce((s, l) => s + l.hours, 0);
      const laborAmountCents = laborEntries.reduce(
        (s, l) => s + laborTotalCents(l.hours, l.rateCents),
        0,
      );

      let partsCostCents = 0;
      let usageCount = 0;
      if (can("parts.read") && hasRepository(PARTS_REPOSITORY)) {
        const usage = await getRepository<PartsRepository>(PARTS_REPOSITORY).listUsage({ jobId });
        usageCount = usage.length;
        partsCostCents = usage.reduce((s, u) => s + u.totalCost, 0);
      }

      let invoicedTotalCents: number | undefined;
      if (can("finance.read") && hasRepository(FINANCE_REPOSITORY)) {
        const invoices = await getRepository<FinanceRepository>(FINANCE_REPOSITORY).listInvoices();
        const linked = invoices.filter((i) => i.jobId === jobId && i.status !== "void");
        if (linked.length > 0) {
          invoicedTotalCents = linked.reduce((s, i) => s + i.total, 0);
        }
      }

      return {
        jobId,
        partsCostCents,
        laborHours,
        laborAmountCents,
        usageCount,
        laborEntries,
        invoicedTotalCents,
      };
    },

    async getPartsUsed(jobId: string) {
      const repo = parts();
      const usage = await repo.listUsage({ jobId });
      const out: Array<PartUsage & { part?: Part }> = [];
      for (const u of usage) {
        out.push({ ...u, part: await repo.getPart(u.partId) });
      }
      return out;
    },

    async getRecentPurchases(limit = 5) {
      const result = await parts().listPurchases();
      return [...result.items]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit);
    },

    async getNewLeads(now = Date.now(), withinMs = 2 * DAY_MS) {
      const all = await leadsRepo().listLeads();
      return all
        .filter((l) => l.createdAt >= now - withinMs && l.status === "new")
        .sort((a, b) => b.createdAt - a.createdAt);
    },

    async getStaleLeads(now = Date.now()) {
      const repo = leadsRepo();
      const items = await repo.listLeadsNeedingAttention({ now });
      const out: Array<LeadAttentionItem & { lead?: Lead }> = [];
      for (const item of items) {
        out.push({ ...item, lead: await repo.getLead(item.leadId) });
      }
      return out;
    },

    async getPendingQuotes() {
      const all = await quotes().listQuotes();
      return all
        .filter((q) => q.status === "sent")
        .sort((a, b) => a.updatedAt - b.updatedAt);
    },

    async getUnpaidInvoices() {
      const all = await finance().listInvoices();
      return all
        .filter(
          (i) => (i.status === "issued" || i.status === "partially_paid") && i.balance > 0,
        )
        .sort((a, b) => (a.dueAt ?? a.issuedAt ?? a.createdAt) - (b.dueAt ?? b.issuedAt ?? b.createdAt));
    },

    async getCollectedRevenue() {
      const all = await finance().listInvoices();
      const live = all.filter((i) => i.status !== "void" && i.status !== "draft");
      return {
        collectedCents: live.reduce((s, i) => s + i.amountPaid, 0),
        outstandingCents: live.reduce((s, i) => s + i.balance, 0),
        invoiceCount: live.length,
      };
    },

    async getPendingCommunications() {
      const all = await comms().listConversations();
      return all.filter(
        (c) =>
          c.awaitingParty === "skild" &&
          c.status !== "resolved" &&
          c.status !== "closed",
      );
    },

    async getReviewOpportunities() {
      const commsRepo = comms();
      if (!can("jobs.read") || !hasRepository(JOBS_REPOSITORY)) return [];
      const allJobs = await getRepository<JobsRepository>(JOBS_REPOSITORY).list();
      const completed = allJobs.filter((j) => j.status === "completed");
      const out: Array<{ job: Job; customerId: string }> = [];
      for (const job of completed) {
        const existing = await commsRepo.listReviewRequests(job.customerId);
        if (existing.some((r) => r.jobId === job.id)) continue;
        out.push({ job, customerId: job.customerId });
      }
      return out;
    },

    async getCustomerHistory(customerId: string) {
      const customer = await customers().get(customerId);
      if (!customer) return undefined;
      const vehicleList = can("vehicles.read") && hasRepository(VEHICLES_REPOSITORY)
        ? (await getRepository<VehicleRepository>(VEHICLES_REPOSITORY).list({ customerId })).items
        : [];
      const jobList = can("jobs.read") && hasRepository(JOBS_REPOSITORY)
        ? (await getRepository<JobsRepository>(JOBS_REPOSITORY).list()).filter((j) => j.customerId === customerId)
        : [];
      const quoteList = can("quotes.read") && hasRepository(QUOTES_REPOSITORY)
        ? (await getRepository<QuotesRepository>(QUOTES_REPOSITORY).listQuotes()).filter((q) => q.customerId === customerId)
        : [];
      const invoiceList = can("finance.read") && hasRepository(FINANCE_REPOSITORY)
        ? (await getRepository<FinanceRepository>(FINANCE_REPOSITORY).listInvoices()).filter((i) => i.customerId === customerId)
        : [];
      return { customer, vehicles: vehicleList, jobs: jobList, quotes: quoteList, invoices: invoiceList };
    },

    async getVehicleHistory(vehicleId: string) {
      const vehicle = await vehicles().get(vehicleId);
      if (!vehicle) return undefined;
      const jobList = can("jobs.read") && hasRepository(JOBS_REPOSITORY)
        ? (await getRepository<JobsRepository>(JOBS_REPOSITORY).list()).filter((j) => j.vehicleId === vehicleId)
        : [];
      const quoteList = can("quotes.read") && hasRepository(QUOTES_REPOSITORY)
        ? (await getRepository<QuotesRepository>(QUOTES_REPOSITORY).listQuotes()).filter((q) => q.vehicleId === vehicleId)
        : [];
      const usage = can("parts.read") && hasRepository(PARTS_REPOSITORY)
        ? await getRepository<PartsRepository>(PARTS_REPOSITORY).listUsage({ vehicleId })
        : [];
      return { vehicle, jobs: jobList, quotes: quoteList, partsUsage: usage };
    },

    async searchKnowledge(term: string, limit = 5) {
      const docs = await knowledge().listDocuments({ status: "active" });
      const needle = term.trim().toLowerCase();
      if (!needle) return docs.slice(0, limit);
      const words = needle.split(/\s+/).filter((w) => w.length > 2);
      const scored = docs
        .map((d) => {
          const hay = `${d.title} ${d.summary} ${d.tags.join(" ")} ${d.content}`.toLowerCase();
          const score = words.reduce((s, w) => (hay.includes(w) ? s + 1 : s), 0);
          return { d, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score);
      return scored.slice(0, limit).map((x) => x.d);
    },

    async getMarketingPerformance() {
      const repo = marketing();
      return {
        sources: await repo.getSourcePerformance(),
        services: await repo.getServicePerformance(),
      };
    },

    async getMarketingOpportunities() {
      return marketing().listOpportunities();
    },

    async getRetentionOpportunities(now = Date.now()) {
      return marketing().listRetentionOpportunities({ now });
    },

    async getAutomationOverview(now = Date.now()) {
      return automation().getOverview(now);
    },

    async getRecentAgentRuns(limit = 10) {
      return automation().listRuns({ limit });
    },

    async getActionsAwaitingApproval() {
      return automation().listActions({ approvalState: "pending" });
    },
  };
}
