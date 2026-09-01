import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import { useAskJarvis, useDailyBrief } from "@/modules/assistant/hooks";
import { JARVIS_READ } from "@/modules/assistant/capabilities";
import type { EvidenceKind } from "@/modules/assistant/data/schemas";

export const Route = createModuleRoute("/jarvis/")({
  moduleId: "assistant",
  head: () => ({
    meta: [
      { title: "Ask Jarvis — Skild OS" },
      {
        name: "description",
        content:
          "Ask about today's work, leads, quotes, parts, and money. Answers cite the records behind them.",
      },
      { property: "og:title", content: "Ask Jarvis — Skild OS" },
      {
        property: "og:description",
        content:
          "Grounded answers from your own records, with explicit gaps where data is missing.",
      },
    ],
  }),
  component: AskJarvisPage,
});

const EVIDENCE_LABEL: Record<EvidenceKind, string> = {
  verified_fact: "verified",
  customer_provided: "customer said",
  system_derived: "derived",
  ai_generated: "AI wording",
  assumption: "assumption",
};

const SUGGESTIONS = [
  "What's happening today?",
  "Which leads need follow-up?",
  "What quotes are waiting on a response?",
  "Who owes us money?",
];

function AskJarvisPage() {
  const canRead = useHasCapability(JARVIS_READ);
  const { data: brief, loading: briefLoading } = useDailyBrief();
  const { ask, answer, asking, error } = useAskJarvis();
  const [question, setQuestion] = useState("");

  if (!canRead) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        You do not have permission to ask Jarvis.
      </p>
    );
  }

  const submit = (text: string) => {
    const q = text.trim();
    if (!q) return;
    setQuestion(q);
    void ask(q);
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4">
      <section>
        <h1 className="text-xl font-semibold">
          {briefLoading ? "Good morning" : (brief?.greeting ?? "Good morning")}
        </h1>
        {brief && (
          <div className="mt-2 space-y-1">
            {brief.sections.map((s) => (
              <p key={s.id} className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{s.label}:</span>{" "}
                {s.lines.map((l) => l.statement).join(" · ")}
              </p>
            ))}
            {brief.omitted.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Not shown: {brief.omitted.join(", ")}.
              </p>
            )}
          </div>
        )}
      </section>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(question);
        }}
      >
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about jobs, leads, quotes, parts, or money…"
          aria-label="Ask Jarvis a question"
        />
        <Button type="submit" disabled={asking}>
          {asking ? "Thinking…" : "Ask"}
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-accent"
            onClick={() => submit(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {answer && (
        <section className="space-y-4 rounded-lg border p-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {answer.intent}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {answer.intentConfidence} confidence · {answer.providerId}
              </span>
            </div>
            <p className="text-sm whitespace-pre-line">{answer.summary}</p>
          </div>

          {answer.facts.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase text-muted-foreground">
                What this rests on
              </h2>
              <ul className="mt-1 space-y-1">
                {answer.facts.map((f) => (
                  <li key={f.id} className="text-sm">
                    <Badge variant="secondary" className="mr-2 text-[10px]">
                      {EVIDENCE_LABEL[f.kind]}
                    </Badge>
                    {f.statement}
                    {f.sources.length > 0 && (
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        ({f.sources.length} source
                        {f.sources.length === 1 ? "" : "s"})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {answer.knowledge.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase text-muted-foreground">
                From your knowledge base
              </h2>
              <ul className="mt-1 space-y-1">
                {answer.knowledge.map((k) => (
                  <li key={k.knowledgeId} className="text-sm">
                    {k.title}{" "}
                    <span className="text-[10px] text-muted-foreground">
                      (v{k.versionNumber})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {answer.recommendations.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase text-muted-foreground">
                Recommendations (interpretation, not fact)
              </h2>
              <ul className="mt-1 space-y-1">
                {answer.recommendations.map((r) => (
                  <li key={r.id} className="text-sm">
                    <span className="font-medium">{r.title}</span> —{" "}
                    <span className="text-muted-foreground">{r.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {answer.uncertainty.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase text-muted-foreground">
                What I don&apos;t know
              </h2>
              <ul className="mt-1 list-disc pl-5">
                {answer.uncertainty.map((u, i) => (
                  <li key={i} className="text-sm text-muted-foreground">
                    {u}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
