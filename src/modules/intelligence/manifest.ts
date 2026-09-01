// Business Intelligence module manifest + bootstrap (Phase 14).
// Importing this file does NOT auto-register — call
// registerIntelligenceModule() from src/core/bootstrap.ts.

import { registerModule } from "@/core/modules/registry";
import { registerRepository } from "@/core/data/registry";
import { INTELLIGENCE_REPOSITORY } from "./data/repository";
import { createLocalIntelligenceRepository } from "./data/local-repository";
import { INTELLIGENCE_CAPABILITIES } from "./capabilities";
import { IntelligenceAttentionWidget } from "./widgets/AttentionWidget";

let registered = false;

export function registerIntelligenceModule(): void {
  if (registered) return;
  registered = true;

  registerRepository(INTELLIGENCE_REPOSITORY, createLocalIntelligenceRepository());

  registerModule({
    id: "intelligence",
    label: "Intelligence",
    description:
      "Business metrics, funnel, profitability and deterministic optimization findings. Measures and proposes; never acts.",
    capabilities: INTELLIGENCE_CAPABILITIES,
    navEntries: [
      {
        id: "intelligence.nav.overview",
        label: "Intelligence",
        route: "/intelligence",
        icon: "BarChart3",
        order: 88,
        requiredCapabilityIds: ["intelligence.read"],
      },
    ],
    commands: [
      {
        id: "intelligence.goto.overview",
        label: "Go to Business Intelligence",
        group: "Navigate",
        keywords: ["intelligence", "metrics", "kpi", "report", "funnel"],
        requiredCapabilityIds: ["intelligence.read"],
        run: () => window.location.assign("/intelligence"),
      },
      {
        id: "intelligence.goto.performance",
        label: "Service and source performance",
        group: "Intelligence",
        keywords: ["performance", "service", "source", "conversion", "margin"],
        requiredCapabilityIds: ["intelligence.read"],
        run: () => window.location.assign("/intelligence/performance"),
      },
      {
        id: "intelligence.goto.findings",
        label: "Optimization findings",
        group: "Intelligence",
        keywords: ["finding", "observation", "opportunity", "recommendation"],
        requiredCapabilityIds: ["intelligence.read"],
        run: () => window.location.assign("/intelligence/findings"),
      },
      {
        id: "intelligence.goto.metrics",
        label: "Metric snapshots",
        group: "Intelligence",
        keywords: ["snapshot", "metric", "history", "baseline"],
        requiredCapabilityIds: ["intelligence.read"],
        run: () => window.location.assign("/intelligence/metrics"),
      },
    ],
    dashboardWidgets: [
      {
        id: "intelligence.attention",
        moduleId: "intelligence",
        title: "Needs attention",
        component: IntelligenceAttentionWidget,
        span: 1,
        order: 6,
        requiredCapabilityIds: ["intelligence.read"],
      },
    ],
  });
}
