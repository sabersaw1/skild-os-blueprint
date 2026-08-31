// Finance module manifest + bootstrap.
// Importing this file does NOT auto-register — call registerFinanceModule()
// from src/core/bootstrap.ts (matches CRM / Vehicles / Quotes / Jobs / Parts).

import { registerModule } from "@/core/modules/registry";
import { registerRepository } from "@/core/data/registry";
import { FINANCE_REPOSITORY } from "./data/repository";
import { createLocalFinanceRepository } from "./data/local-repository";
import { FINANCE_CAPABILITIES } from "./capabilities";
import { RecentInvoicesWidget } from "./widgets/RecentInvoicesWidget";
import { OutstandingBalanceWidget } from "./widgets/OutstandingBalanceWidget";

let registered = false;

export function registerFinanceModule(): void {
  if (registered) return;
  registered = true;

  registerRepository(FINANCE_REPOSITORY, createLocalFinanceRepository());

  registerModule({
    id: "finance",
    label: "Finance",
    description:
      "Invoices, payments, and balances. Issued invoices are immutable records.",
    capabilities: FINANCE_CAPABILITIES,
    navEntries: [
      {
        id: "finance.nav.invoices",
        label: "Invoices",
        route: "/invoices",
        icon: "Receipt",
        order: 50,
        requiredCapabilityIds: ["finance.read"],
      },
    ],
    commands: [
      {
        id: "finance.invoices",
        label: "Go to Invoices",
        group: "Navigate",
        keywords: ["invoice", "billing", "finance", "money"],
        requiredCapabilityIds: ["finance.read"],
        run: () => window.location.assign("/invoices"),
      },
      {
        id: "finance.invoice.new",
        label: "New invoice",
        group: "Finance",
        keywords: ["invoice", "bill", "create", "charge"],
        requiredCapabilityIds: ["finance.invoice.write"],
        run: () => window.location.assign("/invoices/new"),
      },
      {
        id: "finance.invoices.outstanding",
        label: "Outstanding invoices",
        group: "Finance",
        keywords: ["unpaid", "balance", "owing", "receivable"],
        requiredCapabilityIds: ["finance.read"],
        run: () => window.location.assign("/invoices?outstanding=1"),
      },
    ],
    dashboardWidgets: [
      {
        id: "finance.recentInvoices",
        moduleId: "finance",
        title: "Recent invoices",
        component: RecentInvoicesWidget,
        span: 1,
        order: 60,
        requiredCapabilityIds: ["finance.read"],
      },
      {
        id: "finance.outstanding",
        moduleId: "finance",
        title: "Outstanding balance",
        component: OutstandingBalanceWidget,
        span: 1,
        order: 61,
        requiredCapabilityIds: ["finance.read"],
      },
    ],
  });
}
