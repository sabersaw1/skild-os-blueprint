// Parts module manifest + bootstrap.
// Importing this file does NOT auto-register — call registerPartsModule()
// from src/core/bootstrap.ts (matches CRM / Vehicles / Quotes / Jobs).

import { registerModule } from "@/core/modules/registry";
import { registerRepository } from "@/core/data/registry";
import { PARTS_REPOSITORY } from "./data/repository";
import { createLocalPartsRepository } from "./data/local-repository";
import { seedPartSuppliers } from "./data/seed";
import { PARTS_CAPABILITIES } from "./capabilities";
import { RecentPurchasesWidget } from "./widgets/RecentPurchasesWidget";
import { PartsCostWidget } from "./widgets/PartsCostWidget";

let registered = false;

export function registerPartsModule(): void {
  if (registered) return;
  registered = true;

  const repo = createLocalPartsRepository();
  registerRepository(PARTS_REPOSITORY, repo);
  // Supplier metadata seed only — no integrations, no credentials.
  void seedPartSuppliers(repo);

  registerModule({
    id: "parts",
    label: "Parts",
    description:
      "Parts catalog, suppliers, purchases, and parts used on vehicles/jobs.",
    capabilities: PARTS_CAPABILITIES,
    navEntries: [
      {
        id: "parts.nav",
        label: "Parts",
        route: "/parts",
        icon: "Package",
        order: 40,
        requiredCapabilityIds: ["parts.read"],
      },
      {
        id: "parts.nav.purchases",
        label: "Purchases",
        route: "/purchases/parts",
        icon: "ShoppingCart",
        order: 41,
        requiredCapabilityIds: ["parts.read"],
      },
      {
        id: "parts.nav.suppliers",
        label: "Suppliers",
        route: "/suppliers/parts",
        icon: "Truck",
        order: 42,
        requiredCapabilityIds: ["parts.read"],
      },
    ],
    commands: [
      {
        id: "parts.search",
        label: "Search parts",
        group: "Parts",
        keywords: ["part", "catalog", "find"],
        requiredCapabilityIds: ["parts.read"],
        run: () => window.location.assign("/parts"),
      },
      {
        id: "parts.new",
        label: "New part",
        group: "Parts",
        keywords: ["part", "create", "catalog"],
        requiredCapabilityIds: ["parts.write"],
        run: () => window.location.assign("/parts/new"),
      },
      {
        id: "parts.purchase.new",
        label: "New parts purchase",
        group: "Parts",
        keywords: ["purchase", "order", "buy", "receipt"],
        requiredCapabilityIds: ["parts.purchase.write"],
        run: () => window.location.assign("/purchases/parts/new"),
      },
      {
        id: "parts.purchases",
        label: "Parts purchases",
        group: "Parts",
        keywords: ["purchase", "orders", "history"],
        requiredCapabilityIds: ["parts.read"],
        run: () => window.location.assign("/purchases/parts"),
      },
      {
        id: "parts.suppliers",
        label: "Parts suppliers",
        group: "Parts",
        keywords: ["supplier", "vendor", "store"],
        requiredCapabilityIds: ["parts.read"],
        run: () => window.location.assign("/suppliers/parts"),
      },
      {
        id: "parts.goto",
        label: "Go to Parts",
        group: "Navigate",
        keywords: ["part", "inventory", "catalog"],
        requiredCapabilityIds: ["parts.read"],
        run: () => window.location.assign("/parts"),
      },
    ],
    dashboardWidgets: [
      {
        id: "parts.recentPurchases",
        moduleId: "parts",
        title: "Recent purchases",
        component: RecentPurchasesWidget,
        span: 1,
        order: 50,
        requiredCapabilityIds: ["parts.read"],
      },
      {
        id: "parts.partsCost",
        moduleId: "parts",
        title: "Parts cost",
        component: PartsCostWidget,
        span: 1,
        order: 51,
        requiredCapabilityIds: ["parts.read"],
      },
    ],
  });
}
