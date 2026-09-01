// Marketing + Lead Machine module manifest + bootstrap (Phase 11).
// Importing this file does NOT auto-register — call
// registerMarketingModule() from src/core/bootstrap.ts.

import { registerModule } from "@/core/modules/registry";
import { registerRepository } from "@/core/data/registry";
import { MARKETING_REPOSITORY } from "./data/repository";
import { createLocalMarketingRepository } from "./data/local-repository";
import { MARKETING_CAPABILITIES } from "./capabilities";
import { LeadAttentionWidget } from "./widgets/LeadAttentionWidget";

let registered = false;

export function registerMarketingModule(): void {
  if (registered) return;
  registered = true;

  registerRepository(MARKETING_REPOSITORY, createLocalMarketingRepository());

  registerModule({
    id: "marketing",
    label: "Marketing",
    description:
      "Leads, attribution, and marketing opportunities. Recommends only — every action requires human approval.",
    capabilities: MARKETING_CAPABILITIES,
    navEntries: [
      {
        id: "marketing.nav.leads",
        label: "Leads",
        route: "/leads",
        icon: "Target",
        order: 12,
        requiredCapabilityIds: ["leads.read"],
      },
      {
        id: "marketing.nav.marketing",
        label: "Marketing",
        route: "/marketing",
        icon: "Megaphone",
        order: 85,
        requiredCapabilityIds: ["marketing.read"],
      },
    ],
    commands: [
      {
        id: "marketing.goto.leads",
        label: "Go to Leads",
        group: "Navigate",
        keywords: ["lead", "inquiry", "pipeline", "prospect"],
        requiredCapabilityIds: ["leads.read"],
        run: () => window.location.assign("/leads"),
      },
      {
        id: "marketing.lead.new",
        label: "Record a lead",
        group: "Marketing",
        keywords: ["lead", "inquiry", "new", "capture"],
        requiredCapabilityIds: ["leads.write"],
        run: () => window.location.assign("/leads/new"),
      },
      {
        id: "marketing.goto.opportunities",
        label: "Go to Marketing opportunities",
        group: "Navigate",
        keywords: ["marketing", "seo", "opportunity", "content"],
        requiredCapabilityIds: ["marketing.read"],
        run: () => window.location.assign("/marketing"),
      },
      {
        id: "marketing.goto.actions",
        label: "Marketing actions awaiting approval",
        group: "Marketing",
        keywords: ["approve", "action", "review", "publish"],
        requiredCapabilityIds: ["marketing.read"],
        run: () => window.location.assign("/marketing/actions"),
      },
      {
        id: "marketing.goto.performance",
        label: "Marketing performance",
        group: "Marketing",
        keywords: ["source", "revenue", "conversion", "report"],
        requiredCapabilityIds: ["marketing.read"],
        run: () => window.location.assign("/marketing/performance"),
      },
    ],
    dashboardWidgets: [
      {
        id: "marketing.leads.attention",
        moduleId: "marketing",
        title: "Leads needing attention",
        component: LeadAttentionWidget,
        span: 1,
        order: 12,
        requiredCapabilityIds: ["leads.read"],
      },
    ],
  });
}
