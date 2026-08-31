// Finance storage — thin re-export of the generic core envelope helpers.
// Finance-specific keys and migrations are declared in ./local-repository.
// Only the Finance repository implementation may import this module.

export {
  registerVersionedKey,
  readEnvelope,
  writeEnvelope,
  _resetVersionedKeys,
  type Envelope,
  type Migration,
} from "@/core/storage/envelope";
