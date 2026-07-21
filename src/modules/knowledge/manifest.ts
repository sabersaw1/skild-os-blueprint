// Knowledge module manifest + bootstrap.
// Importing this file does NOT auto-register — call registerKnowledgeModule()
// from src/core/bootstrap.ts (matches CRM / Vehicles pattern).

import { registerModule } from "@/core/modules/registry";
import { registerRepository } from "@/core/data/registry";
import { KNOWLEDGE_REPOSITORY } from "./data/repository";
import { createLocalKnowledgeRepository } from "./data/local-repository";
import { KNOWLEDGE_CAPABILITIES } from "./capabilities";

let registered = false;

export function registerKnowledgeModule(): void {
  if (registered) return;
  registered = true;

  // Register the local repository under the DI key. Later phases swap this
  // for a Supabase / local-server implementation with no component edits.
  registerRepository(KNOWLEDGE_REPOSITORY, createLocalKnowledgeRepository());

  registerModule({
    id: "knowledge",
    label: "Knowledge",
    description:
      "Structured business memory: SOPs, repair knowledge, pricing rules, and lessons.",
    capabilities: KNOWLEDGE_CAPABILITIES,
    navEntries: [
      {
        id: "knowledge.nav",
        label: "Knowledge",
        route: "/knowledge",
        icon: "BookOpen",
        order: 30,
        requiredCapabilityIds: ["knowledge.read"],
      },
    ],
    commands: [
      {
        id: "knowledge.new",
        label: "New knowledge document",
        group: "Knowledge",
        keywords: ["create", "add", "sop", "rule", "note"],
        requiredCapabilityIds: ["knowledge.write"],
        run: () => window.location.assign("/knowledge/new"),
      },
      {
        id: "knowledge.goto",
        label: "Go to Knowledge",
        group: "Navigate",
        keywords: ["knowledge", "sop"],
        requiredCapabilityIds: ["knowledge.read"],
        run: () => window.location.assign("/knowledge"),
      },
      {
        id: "knowledge.search",
        label: "Search knowledge",
        group: "Knowledge",
        keywords: ["find", "search"],
        requiredCapabilityIds: ["knowledge.read"],
        run: () => window.location.assign("/knowledge"),
      },
    ],
  });
}
