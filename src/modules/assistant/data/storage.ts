// Assistant storage — thin re-export of the generic core envelope helpers.
// Module-specific keys and migrations are declared in ./local-repository.
// Only the assistant repository implementation may import this module;
// components and the model provider must never touch storage.

export {
  registerVersionedKey,
  readEnvelope,
  writeEnvelope,
  _resetVersionedKeys,
  type Envelope,
  type Migration,
} from "@/core/storage/envelope";
