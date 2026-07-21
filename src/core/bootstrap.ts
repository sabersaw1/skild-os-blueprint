// Phase 1 bootstrap: register the shell's own module manifest so the
// registry-driven navigation, command bar, settings hub, and modules
// listing all have real content to display, and so the module contract
// is exercised end-to-end from day one.
//
// Product modules (CRM, Vehicles, Inspections, etc.) are NOT registered
// in Phase 1.

import { registerModule } from "./modules/registry";
import { openCommandBar } from "./commands/CommandBar";
import { registerReservedCapabilities } from "./roles/reserved-capabilities";
import { registerCrmModule } from "@/modules/crm";
import { registerVehiclesModule } from "@/modules/vehicles";
import { registerKnowledgeModule } from "@/modules/knowledge";
import { registerInspectionsModule } from "@/modules/inspections";

let bootstrapped = false;

export function bootstrapPhase1() {
  if (bootstrapped) return;
  bootstrapped = true;

  // Reserve capability IDs owned by future modules (knowledge, ai, system).
  // Registering here is behaviourally neutral today — the Owner role holds
  // "*" — but locks the IDs against accidental squatting by Phase 2 work.
  registerReservedCapabilities();

  registerModule({
    id: "shell",
    label: "Shell",
    description:
      "Application shell, navigation, command bar, and dashboard host.",
    navEntries: [
      {
        id: "shell.home",
        label: "Command Center",
        route: "/",
        icon: "LayoutDashboard",
        order: 1,
        requiredCapabilityIds: ["shell.navigate"],
      },
      {
        id: "shell.activity",
        label: "Activity",
        route: "/activity",
        icon: "Activity",
        order: 90,
        requiredCapabilityIds: ["activity.read"],
      },
      {
        id: "shell.settings",
        label: "Settings",
        route: "/settings",
        icon: "Settings",
        order: 99,
        requiredCapabilityIds: ["settings.read"],
      },
    ],
    commands: [
      {
        id: "shell.goto.home",
        label: "Go to Command Center",
        group: "Navigate",
        keywords: ["home", "dashboard"],
        requiredCapabilityIds: ["shell.navigate"],
        run: () => {
          window.location.assign("/");
        },
      },
      {
        id: "shell.goto.activity",
        label: "Go to Activity",
        group: "Navigate",
        keywords: ["log", "history"],
        requiredCapabilityIds: ["activity.read"],
        run: () => {
          window.location.assign("/activity");
        },
      },
      {
        id: "shell.goto.settings",
        label: "Go to Settings",
        group: "Navigate",
        keywords: ["preferences", "config"],
        requiredCapabilityIds: ["settings.read"],
        run: () => {
          window.location.assign("/settings");
        },
      },
      {
        id: "shell.commandbar.open",
        label: "Open Command Bar",
        group: "General",
        keywords: ["palette", "search"],
        run: () => openCommandBar(),
      },
    ],
    settingsSections: [
      {
        id: "settings.profile",
        moduleId: "shell",
        label: "Profile",
        route: "/settings/profile",
        order: 1,
        requiredCapabilityIds: ["settings.read"],
      },
      {
        id: "settings.appearance",
        moduleId: "shell",
        label: "Appearance",
        route: "/settings/appearance",
        order: 2,
        requiredCapabilityIds: ["settings.read"],
      },
      {
        id: "settings.modules",
        moduleId: "shell",
        label: "Modules",
        route: "/settings/modules",
        order: 99,
        requiredCapabilityIds: ["settings.read"],
      },
    ],
  });

  // Product modules (Phase 2).
  registerCrmModule();
  registerVehiclesModule();

  // Product modules (Phase 3).
  registerKnowledgeModule();

  // Product modules (Phase 4).
  registerInspectionsModule();
}
