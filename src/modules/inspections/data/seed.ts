// Optional dev seed for the Inspections module.
// Not called in Phase 4 — kept as a marker so future demo work has a
// documented insertion point that goes through the repository (never
// direct storage writes).

import type { InspectionsRepository } from "./repository";

export async function seedInspections(
  _repo: InspectionsRepository,
): Promise<void> {
  // Intentionally empty in Phase 4.
}
