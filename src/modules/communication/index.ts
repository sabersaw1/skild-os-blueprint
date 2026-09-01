// Customer Communication module — public surface.
// Other modules and the shell import ONLY from this file.

export { registerCommunicationModule } from "./manifest";
export {
  COMMUNICATION_REPOSITORY,
  type CommunicationRepository,
} from "./data/repository";
export {
  COMMUNICATION_EVENTS,
  type CommunicationEventType,
} from "./activity";
export {
  COMMUNICATION_CAPABILITIES,
  APPROVAL_REQUIRED_MESSAGE_TYPES,
} from "./capabilities";
export { SKILD_TIME_ZONE, formatDenver, formatAge } from "./data/time";
export type * from "./data/schemas";
