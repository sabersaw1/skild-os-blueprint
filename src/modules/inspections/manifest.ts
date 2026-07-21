// Inspections module manifest + bootstrap.
// Importing this file does NOT auto-register — call registerInspectionsModule()
// from src/core/bootstrap.ts (matches CRM / Vehicles / Knowledge pattern).

import { registerModule } from "@/core/modules/registry";
import { registerRepository } from "@/core/data/registry";
import { INSPECTIONS_REPOSITORY } from "./data/repository";
import { createLocalInspectionsRepository } from "./data/local-repository";
import { INSPECTIONS_CAPABILITIES } from "./capabilities";
import { RecentInspectionsWidget } from "./widgets/RecentInspectionsWidget";

let registered = false;

export function registerInspectionsModule(): void {
  if (registered) return;
  registered = true;

  registerRepository(
    INSPECTIONS_REPOSITORY,
    createLocalInspectionsRepository(),
  );

  registerModule({
    id: "inspections",
    label: "Inspections",
    description:
      "Vehicle inspections: templates, findings, condition records, and photo queue.",
    capabilities: INSPECTIONS_CAPABILITIES,
    navEntries: [
      {
        id: "inspections.nav",
        label: "Inspections",
        route: "/inspections",
        icon: "ClipboardCheck",
        order: 25,
        requiredCapabilityIds: ["inspections.read"],
      },
    ],
    commands: [
      {
        id: "inspections.new",
        label: "New inspection",
        group: "Inspections",
        keywords: ["create", "start", "inspection"],
        requiredCapabilityIds: ["inspections.write"],
        run: () => window.location.assign("/inspections/new"),
      },
      {
        id: "inspections.goto",
        label: "Go to Inspections",
        group: "Navigate",
        keywords: ["inspection", "findings"],
        requiredCapabilityIds: ["inspections.read"],
        run: () => window.location.assign("/inspections"),
      },
      {
        id: "inspections.templates.goto",
        label: "Manage inspection templates",
        group: "Inspections",
        keywords: ["template", "checklist"],
        requiredCapabilityIds: ["inspections.templates.write"],
        run: () => window.location.assign("/templates/inspections"),
      },
      {
        id: "inspections.templates.new",
        label: "New inspection template",
        group: "Inspections",
        keywords: ["template", "create", "checklist"],
        requiredCapabilityIds: ["inspections.templates.write"],
        run: () => window.location.assign("/templates/inspections/new"),
      },
    ],
    dashboardWidgets: [
      {
        id: "inspections.recent",
        moduleId: "inspections",
        title: "Recent inspections",
        component: RecentInspectionsWidget,
        span: 1,
        order: 30,
        requiredCapabilityIds: ["inspections.read"],
      },
    ],
  });
}
