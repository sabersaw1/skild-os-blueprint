// Deterministic model provider (Phase 12 default).
//
// Composes an answer purely from the grounded facts it is handed. It cannot
// invent a record, because it has no source of text other than the facts,
// recommendations, and knowledge citations in the request. This is also the
// provider used by the test-suite, which is why it is deterministic: the
// same request always yields the same summary.
//
// It performs no network I/O and holds no credentials.

import type { ModelProvider, ModelRequest, ModelResponse } from "./types";

function sentence(list: string[]): string {
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  return `${list.slice(0, -1).join("; ")}; and ${list[list.length - 1]}`;
}

export function createDeterministicProvider(): ModelProvider {
  return {
    id: "deterministic",
    label: "Deterministic (no external model)",
    remote: false,
    async complete(request: ModelRequest): Promise<ModelResponse> {
      const grounded = request.facts.filter(
        (f) => f.kind === "verified_fact" || f.kind === "system_derived",
      );

      const parts: string[] = [];
      if (grounded.length > 0) {
        parts.push(sentence(grounded.map((f) => f.statement)) + ".");
      } else {
        parts.push(
          "No matching business records were found, so there is nothing to report.",
        );
      }

      if (request.recommendations.length > 0) {
        parts.push(
          `Recommendations (not facts): ${sentence(
            request.recommendations.map((r) => `${r.title} — ${r.reason}`),
          )}.`,
        );
      }

      if (request.knowledge.length > 0) {
        parts.push(
          `Relevant business knowledge: ${sentence(
            request.knowledge.map((k) => `${k.title} (v${k.versionNumber})`),
          )}.`,
        );
      }

      const uncertainty: string[] = [];
      if (request.intent === "unknown") {
        uncertainty.push(
          "This question was not recognised as a supported business query, so the answer may be incomplete.",
        );
      }
      if (grounded.length === 0 && request.uncertainty.length === 0) {
        uncertainty.push("No records matched; nothing is being asserted.");
      }

      return { summary: parts.join(" "), uncertainty };
    },
  };
}
