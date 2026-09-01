// Jarvis / AI Business Assistant module — public surface.
// Other modules and the shell import ONLY from this file.

export { registerAssistantModule } from "./manifest";
export {
  ASSISTANT_REPOSITORY,
  type AssistantRepository,
} from "./data/repository";
export { ASSISTANT_EVENTS, type AssistantEventType } from "./activity";
export {
  ASSISTANT_CAPABILITIES,
  JARVIS_READ,
  JARVIS_RECOMMEND,
  JARVIS_PROPOSE,
  JARVIS_EXECUTE,
} from "./capabilities";
export { askJarvis, getAttention, getDailyBrief, getRecommendations } from "./service";
export { classifyIntent } from "./intent/classify";
export {
  getModelProvider,
  setModelProvider,
  resetModelProvider,
} from "./provider/registry";
export type { ModelProvider, ModelRequest, ModelResponse } from "./provider/types";
export { JARVIS_TOOL_CATALOGUE, createJarvisTools } from "./tools";
export type * from "./data/schemas";
