// Automation / Agents module — public surface.
// Other modules and the shell import ONLY from this file.

export { registerAutomationModule } from "./manifest";
export {
  AUTOMATION_REPOSITORY,
  type AutomationRepository,
} from "./data/repository";
export { AUTOMATION_EVENTS, type AutomationEventType } from "./activity";
export { AUTOMATION_CAPABILITIES } from "./capabilities";
export {
  ACTION_CATALOGUE,
  autoExecutableActionTypes,
  decideActionPolicy,
} from "./data/policy";
export {
  executeAction,
  executeApprovedActions,
  idempotencyKey,
  runAutomationRule,
  type RunReport,
} from "./engine/executor";
export {
  activityEventTrigger,
  evaluateConditions,
  manualTrigger,
  observerTrigger,
  scheduleTrigger,
  triggerMatches,
} from "./engine/triggers";
export type * from "./data/schemas";
