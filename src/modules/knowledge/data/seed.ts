// Optional dev seed for the Knowledge module.
// Not called in Phase 3 — kept as a marker so future demo work has a
// documented insertion point that goes through the repository (never
// direct storage writes).

import type { KnowledgeRepository } from "./repository";

export async function seedKnowledge(_repo: KnowledgeRepository): Promise<void> {
  // Intentionally empty in Phase 3.
}
