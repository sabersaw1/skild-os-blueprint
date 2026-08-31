// Parts & Purchasing module — public surface.
// Other modules and the shell import ONLY from this file.

export { registerPartsModule } from "./manifest";
export { PARTS_REPOSITORY, type PartsRepository } from "./data/repository";
export { PART_EVENTS, type PartEventType } from "./activity";
export { PARTS_CAPABILITIES } from "./capabilities";
export {
  toCents,
  toDollars,
  formatCents,
  computePurchaseTotals,
} from "./data/money";
export type * from "./data/schemas";
