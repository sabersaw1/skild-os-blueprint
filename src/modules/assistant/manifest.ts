// Jarvis / AI Business Assistant manifest + bootstrap (Phase 12).
// Importing this file does NOT auto-register — call
// registerAssistantModule() from src/core/bootstrap.ts.

import { registerModule } from "@/core/modules/registry";
import { registerRepository } from "@/core/data/registry";
import { ASSISTANT_REPOSITORY } from "./data/repository";
import { LocalAssistantRepository } from "./data/local-repository";
import { ASSISTANT_CAPABILITIES, JARVIS_READ } from "./capabilities";
import { AttentionWidget } from "./widgets/AttentionWidget";

let registered = false;

export function registerAssistantModule(): void {
  if (registered) return;
  registered = true;

  registerRepository(ASSISTANT_REPOSITORY, new LocalAssistantRepository());

  registerModule({
    id: "assistant",
    label: "Jarvis",
    description:
      "Grounded business assistant. Reads real records, cites them, declares what it does not know, and proposes only.",
    capabilities: ASSISTANT_CAPABILITIES,
    navEntries: [
      {
        id: "assistant.nav.jarvis",
        label: "Jarvis",
        route: "/jarvis",
        icon: "Sparkles",
        order: 2,
        requiredCapabilityIds: [JARVIS_READ],
      },
    ],
    commands: [
      {
        id: "assistant.goto.jarvis",
        label: "Ask Jarvis",
        group: "Navigate",
        keywords: ["jarvis", "ai", "assistant", "ask", "question"],
        requiredCapabilityIds: [JARVIS_READ],
        run: () => window.location.assign("/jarvis"),
      },
      {
        id: "assistant.goto.attention",
        label: "What needs my attention?",
        group: "Jarvis",
        keywords: ["attention", "today", "urgent", "follow up"],
        requiredCapabilityIds: [JARVIS_READ],
        run: () => window.location.assign("/jarvis/attention"),
      },
      {
        id: "assistant.goto.proposals",
        label: "Review AI proposals",
        group: "Jarvis",
        keywords: ["proposal", "approve", "ai", "suggestion"],
        requiredCapabilityIds: [JARVIS_READ],
        run: () => window.location.assign("/jarvis/proposals"),
      },
    ],
    dashboardWidgets: [
      {
        id: "assistant.attention",
        moduleId: "assistant",
        title: "Jarvis: needs attention",
        component: AttentionWidget,
        span: 1,
        order: 2,
        requiredCapabilityIds: [JARVIS_READ],
      },
    ],
  });
}
