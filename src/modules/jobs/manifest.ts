// Jobs module manifest + bootstrap.
// Importing this file does NOT auto-register — call registerJobsModule()
// from src/core/bootstrap.ts.

import { registerModule } from "@/core/modules/registry";
import { registerRepository } from "@/core/data/registry";
import { JOBS_REPOSITORY } from "./data/repository";
import { createLocalJobsRepository } from "./data/local-repository";
import { JOBS_CAPABILITIES } from "./capabilities";
import { RecentJobsWidget } from "./widgets/RecentJobsWidget";

let registered = false;

export function registerJobsModule(): void {
  if (registered) return;
  registered = true;

  registerRepository(JOBS_REPOSITORY, createLocalJobsRepository());

  registerModule({
    id: "jobs",
    label: "Jobs",
    description:
      "Repair execution: schedule, assign, log labor and notes against approved work.",
    capabilities: JOBS_CAPABILITIES,
    navEntries: [
      {
        id: "jobs.nav",
        label: "Jobs",
        route: "/jobs",
        icon: "Wrench",
        order: 35,
        requiredCapabilityIds: ["jobs.read"],
      },
    ],
    commands: [
      {
        id: "jobs.new",
        label: "New job",
        group: "Jobs",
        keywords: ["create", "work", "job", "ticket"],
        requiredCapabilityIds: ["jobs.write"],
        run: () => window.location.assign("/jobs/new"),
      },
      {
        id: "jobs.search",
        label: "Search jobs",
        group: "Jobs",
        keywords: ["find", "job", "work"],
        requiredCapabilityIds: ["jobs.read"],
        run: () => window.location.assign("/jobs"),
      },
      {
        id: "jobs.goto",
        label: "Go to Jobs",
        group: "Navigate",
        keywords: ["job", "work"],
        requiredCapabilityIds: ["jobs.read"],
        run: () => window.location.assign("/jobs"),
      },
    ],
    dashboardWidgets: [
      {
        id: "jobs.recentJobs",
        moduleId: "jobs",
        title: "Recent jobs",
        component: RecentJobsWidget,
        span: 1,
        order: 50,
        requiredCapabilityIds: ["jobs.read"],
      },
    ],
  });
}
