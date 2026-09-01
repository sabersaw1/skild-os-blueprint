// Communication module manifest + bootstrap.
// Importing this file does NOT auto-register — call
// registerCommunicationModule() from src/core/bootstrap.ts (matches CRM /
// Vehicles / Quotes / Jobs / Parts / Finance).

import { registerModule } from "@/core/modules/registry";
import { registerRepository } from "@/core/data/registry";
import { COMMUNICATION_REPOSITORY } from "./data/repository";
import { createLocalCommunicationRepository } from "./data/local-repository";
import { COMMUNICATION_CAPABILITIES } from "./capabilities";
import { AwaitingResponseWidget } from "./widgets/AwaitingResponseWidget";

let registered = false;

export function registerCommunicationModule(): void {
  if (registered) return;
  registered = true;

  registerRepository(
    COMMUNICATION_REPOSITORY,
    createLocalCommunicationRepository(),
  );

  registerModule({
    id: "communication",
    label: "Communication",
    description:
      "Customer conversations, messages, and intake requests. Provider-agnostic; nothing sends without human approval.",
    capabilities: COMMUNICATION_CAPABILITIES,
    navEntries: [
      {
        id: "communication.nav.conversations",
        label: "Conversations",
        route: "/conversations",
        icon: "MessagesSquare",
        order: 15,
        requiredCapabilityIds: ["communication.read"],
      },
    ],
    commands: [
      {
        id: "communication.conversations",
        label: "Go to Conversations",
        group: "Navigate",
        keywords: ["message", "inbox", "customer", "chat", "communication"],
        requiredCapabilityIds: ["communication.read"],
        run: () => window.location.assign("/conversations"),
      },
      {
        id: "communication.conversation.new",
        label: "New conversation",
        group: "Communication",
        keywords: ["message", "thread", "contact", "inquiry"],
        requiredCapabilityIds: ["communication.write"],
        run: () => window.location.assign("/conversations/new"),
      },
      {
        id: "communication.awaiting",
        label: "Conversations awaiting Skild",
        group: "Communication",
        keywords: ["reply", "respond", "waiting", "followup"],
        requiredCapabilityIds: ["communication.read"],
        run: () => window.location.assign("/conversations?awaiting=skild"),
      },
      {
        id: "communication.requests",
        label: "Service requests (intake)",
        group: "Communication",
        keywords: ["intake", "inquiry", "lead", "request"],
        requiredCapabilityIds: ["communication.read"],
        run: () => window.location.assign("/requests"),
      },
    ],
    dashboardWidgets: [
      {
        id: "communication.awaiting",
        moduleId: "communication",
        title: "Awaiting our reply",
        component: AwaitingResponseWidget,
        span: 1,
        order: 15,
        requiredCapabilityIds: ["communication.read"],
      },
    ],
  });
}
