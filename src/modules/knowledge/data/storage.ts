// Knowledge storage — thin re-export of the generic core envelope helpers.
// Knowledge-specific keys and migrations are declared in ./local-repository.
// Only the Knowledge repository implementation may import this module.

export {
  registerVersionedKey,
  readEnvelope,
  writeEnvelope,
  _resetVersionedKeys,
  type Envelope,
  type Migration,
} from "@/core/storage/envelope";
