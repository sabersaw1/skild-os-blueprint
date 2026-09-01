// Business Intelligence module — public surface.
// Other modules and the shell import ONLY from this file.

export { registerIntelligenceModule } from "./manifest";
export {
  INTELLIGENCE_REPOSITORY,
  type IntelligenceRepository,
} from "./data/repository";
export { INTELLIGENCE_EVENTS, type IntelligenceEventType } from "./activity";
export { INTELLIGENCE_CAPABILITIES } from "./capabilities";
export { METRIC_DEFINITIONS, findMetricCalculator } from "./data/calculations";
export type * from "./data/schemas";
