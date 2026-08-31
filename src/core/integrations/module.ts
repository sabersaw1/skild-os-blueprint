// Integrations module manifest + bootstrap.
// Importing this file does NOT auto-register — call
// registerIntegrationsModule() from src/core/bootstrap.ts.

import { registerModule } from "@/core/modules/registry";
import { registerRepository } from "@/core/data/registry";
import { INTEGRATIONS_REPOSITORY } from "./repository";
import { createLocalIntegrationRepository } from "./local-repository";
import { INTEGRATION_CAPABILITIES } from "./capabilities";
import { registerBuiltInAdapters } from "./adapters";

let registered = false;

export function registerIntegrationsModule(): void {
  if (registered) return;
  registered = true;

  registerRepository(INTEGRATIONS_REPOSITORY, createLocalIntegrationRepository());
  registerBuiltInAdapters();

  registerModule({
    id: "integrations",
    label: "Integrations",
    description:
      "External connection foundation: provider adapters, connection state, sync state, and external-record identity.",
    capabilities: INTEGRATION_CAPABILITIES,
    commands: [
      {
        id: "integrations.goto",
        label: "Go to Integrations",
        group: "Navigate",
        keywords: ["connection", "provider", "gmail", "calendar", "supplier"],
        requiredCapabilityIds: ["integrations.read"],
        run: () => window.location.assign("/settings/integrations"),
      },
    ],
    settingsSections: [
      {
        id: "settings.integrations",
        moduleId: "integrations",
        label: "Integrations",
        route: "/settings/integrations",
        order: 50,
        requiredCapabilityIds: ["integrations.read"],
      },
    ],
  });
}
