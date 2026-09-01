// Intelligence storage — thin re-export of the generic core envelope helpers.
// Module-specific keys and migrations are declared in ./local-repository.
// Only the Intelligence repository implementation may import this module;
// components must never touch storage directly.

export {
  registerVersionedKey,
  readEnvelope,
  writeEnvelope,
  _resetVersionedKeys,
  type Envelope,
  type Migration,
} from "@/core/storage/envelope";
