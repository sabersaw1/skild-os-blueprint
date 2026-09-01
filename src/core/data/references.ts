// Referential integrity across module boundaries.
//
// A Job points at a Customer, a Quote at a Vehicle, an Invoice at a Job.
// Modules must never import each other's repositories to check those ids,
// so verification goes through the Data Registry: the owning module is
// asked whether the id resolves.
//
// Deliberate design choices:
//  - Absent repository => SKIPPED, not a failure. A module may legitimately
//    not be bootstrapped (tests, a trimmed deployment, a future server-side
//    surface). Hard-failing there would couple every module to every other.
//  - Verification is async, so it runs BEFORE the persist step of the
//    authorize → validate → persist → confirm → emit invariant.

import { getRepository, hasRepository, type RepositoryKey } from "./registry";

/** Minimal shape a repository must expose to participate in id checks. */
interface Gettable {
  get(id: string): Promise<unknown | undefined>;
}

export type ReferenceCheckResult = "ok" | "skipped";

export interface ReferenceSpec {
  /** Registry key of the module that owns the referenced entity. */
  repository: RepositoryKey;
  /** Field name reported in the error message, e.g. "customerId". */
  field: string;
  /** The id to verify. `undefined`/empty is treated as "not provided". */
  id: string | null | undefined;
  /** Human-readable entity name for the error, e.g. "Customer". */
  entity: string;
  /** When true, an absent id is itself an error. */
  required?: boolean;
  /** Override the lookup when the repository's getter isn't `get`. */
  lookup?: (repo: unknown, id: string) => Promise<unknown | undefined>;
}

export class ReferenceIntegrityError extends Error {
  readonly field: string;
  constructor(field: string, message: string) {
    super(message);
    this.name = "ReferenceIntegrityError";
    this.field = field;
  }
}

/**
 * Verify one cross-module reference. Returns "skipped" when the owning
 * module isn't registered; throws ReferenceIntegrityError when the id is
 * present but resolves to nothing.
 */
export async function verifyReference(
  spec: ReferenceSpec,
): Promise<ReferenceCheckResult> {
  const id = spec.id?.trim();
  if (!id) {
    if (spec.required) {
      throw new ReferenceIntegrityError(
        spec.field,
        `${spec.field} is required.`,
      );
    }
    return "ok";
  }
  if (!hasRepository(spec.repository)) return "skipped";

  const repo = getRepository<unknown>(spec.repository);
  const found = spec.lookup
    ? await spec.lookup(repo, id)
    : await (repo as Gettable).get(id);

  if (found === undefined || found === null) {
    throw new ReferenceIntegrityError(
      spec.field,
      `${spec.entity} "${id}" does not exist (${spec.field}).`,
    );
  }
  return "ok";
}

/** Verify several references; the first failure throws. */
export async function verifyReferences(
  specs: ReferenceSpec[],
): Promise<void> {
  for (const spec of specs) {
    await verifyReference(spec);
  }
}
