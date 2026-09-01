// Marketing + Lead Machine module — public surface.
// Other modules and the shell import ONLY from this file.

export { registerMarketingModule } from "./manifest";
export {
  MARKETING_REPOSITORY,
  type MarketingRepository,
} from "./data/repository";
export { MARKETING_EVENTS, type MarketingEventType } from "./activity";
export { MARKETING_CAPABILITIES } from "./capabilities";
export { scoreLead, scoreSearchOpportunity } from "./data/scoring";
export type * from "./data/schemas";
