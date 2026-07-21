// Quotes module manifest + bootstrap.
// Importing this file does NOT auto-register — call registerQuotesModule()
// from src/core/bootstrap.ts (matches CRM / Vehicles / Knowledge / Inspections).

import { registerModule } from "@/core/modules/registry";
import { registerRepository } from "@/core/data/registry";
import { QUOTES_REPOSITORY } from "./data/repository";
import { createLocalQuotesRepository } from "./data/local-repository";
import { QUOTES_CAPABILITIES } from "./capabilities";
import { RecentQuotesWidget } from "./widgets/RecentQuotesWidget";

let registered = false;

export function registerQuotesModule(): void {
  if (registered) return;
  registered = true;

  registerRepository(QUOTES_REPOSITORY, createLocalQuotesRepository());

  registerModule({
    id: "quotes",
    label: "Quotes",
    description:
      "Customer quotes: line items, versions, and approval status flow.",
    capabilities: QUOTES_CAPABILITIES,
    navEntries: [
      {
        id: "quotes.nav",
        label: "Quotes",
        route: "/quotes",
        icon: "FileText",
        order: 30,
        requiredCapabilityIds: ["quotes.read"],
      },
    ],
    commands: [
      {
        id: "quotes.new",
        label: "New quote",
        group: "Quotes",
        keywords: ["create", "estimate", "quote"],
        requiredCapabilityIds: ["quotes.write"],
        run: () => window.location.assign("/quotes/new"),
      },
      {
        id: "quotes.search",
        label: "Search quotes",
        group: "Quotes",
        keywords: ["find", "quote", "estimate"],
        requiredCapabilityIds: ["quotes.read"],
        run: () => window.location.assign("/quotes"),
      },
      {
        id: "quotes.goto",
        label: "Go to Quotes",
        group: "Navigate",
        keywords: ["quote", "estimate"],
        requiredCapabilityIds: ["quotes.read"],
        run: () => window.location.assign("/quotes"),
      },
    ],
    dashboardWidgets: [
      {
        id: "quotes.recentQuotes",
        moduleId: "quotes",
        title: "Recent quotes",
        component: RecentQuotesWidget,
        span: 1,
        order: 40,
        requiredCapabilityIds: ["quotes.read"],
      },
    ],
  });
}
