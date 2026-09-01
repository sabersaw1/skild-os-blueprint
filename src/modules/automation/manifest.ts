// Automation / Agents module manifest + bootstrap (Phase 13).
// Importing this file does NOT auto-register — call
// registerAutomationModule() from src/core/bootstrap.ts.

import { registerModule } from "@/core/modules/registry";
import { registerRepository } from "@/core/data/registry";
import { AUTOMATION_REPOSITORY } from "./data/repository";
import { createLocalAutomationRepository } from "./data/local-repository";
import { AUTOMATION_CAPABILITIES } from "./capabilities";
import { seedDefaultAutomation } from "./data/seed";
import { AutomationStatusWidget } from "./widgets/AutomationStatusWidget";

let registered = false;

export function registerAutomationModule(): void {
  if (registered) return;
  registered = true;

  const repo = createLocalAutomationRepository();
  registerRepository(AUTOMATION_REPOSITORY, repo);

  // Seeding is best-effort: an actor without `agents.write` simply gets no
  // default agents, which is correct — a denial must never break bootstrap.
  void seedDefaultAutomation(repo).catch(() => undefined);

  registerModule({
    id: "automation",
    label: "Automation",
    description:
      "Agents, automation rules, runs, and approvals. Agents propose; humans authorize anything consequential.",
    capabilities: AUTOMATION_CAPABILITIES,
    navEntries: [
      {
        id: "automation.nav",
        label: "Automation",
        route: "/automation",
        icon: "Bot",
        order: 88,
        requiredCapabilityIds: ["agents.read"],
      },
    ],
    commands: [
      {
        id: "automation.goto",
        label: "Go to Automation",
        group: "Navigate",
        keywords: ["agent", "automation", "rule", "bot"],
        requiredCapabilityIds: ["agents.read"],
        run: () => window.location.assign("/automation"),
      },
      {
        id: "automation.goto.runs",
        label: "Agent runs",
        group: "Automation",
        keywords: ["run", "history", "trace", "failure"],
        requiredCapabilityIds: ["agents.read"],
        run: () => window.location.assign("/automation/runs"),
      },
      {
        id: "automation.goto.approvals",
        label: "Agent actions awaiting approval",
        group: "Automation",
        keywords: ["approve", "reject", "pending", "authorize"],
        requiredCapabilityIds: ["agents.read"],
        run: () => window.location.assign("/automation/approvals"),
      },
    ],
    dashboardWidgets: [
      {
        id: "automation.status",
        moduleId: "automation",
        title: "Automation status",
        component: AutomationStatusWidget,
        span: 1,
        order: 14,
        requiredCapabilityIds: ["agents.read"],
      },
    ],
  });
}
