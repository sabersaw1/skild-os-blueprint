import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import {
  useAssistantRepository,
  useJarvisAttention,
  useJarvisRecommendations,
} from "@/modules/assistant/hooks";
import {
  JARVIS_PROPOSE,
  JARVIS_READ,
} from "@/modules/assistant/capabilities";
import type { AttentionPriority } from "@/modules/assistant/data/schemas";

export const Route = createModuleRoute("/jarvis/attention")({
  moduleId: "assistant",
  head: () => ({
    meta: [
      { title: "Needs Attention — Jarvis — Skild OS" },
      {
        name: "description",
        content:
          "Everything in Skild OS that may need a person, derived live from real records.",
      },
      { property: "og:title", content: "Needs Attention — Jarvis — Skild OS" },
      {
        property: "og:description",
        content:
          "Derived on read from jobs, leads, quotes, parts, and invoices — never stored, never guessed.",
      },
    ],
  }),
  component: AttentionPage,
});

const VARIANT: Record<AttentionPriority, "default" | "secondary" | "destructive" | "outline"> = {
  urgent: "destructive",
  high: "default",
  normal: "secondary",
  low: "outline",
};

function AttentionPage() {
  const canRead = useHasCapability(JARVIS_READ);
  const canPropose = useHasCapability(JARVIS_PROPOSE);
  const repo = useAssistantRepository();
  const { data: items, loading, refresh } = useJarvisAttention();
  const { data: recommendations } = useJarvisRecommendations();
  const [error, setError] = useState<string | null>(null);

  if (!canRead) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        You do not have permission to view this.
      </p>
    );
  }

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const recByCategory = new Map(
    recommendations.map((r) => [r.reason, r] as const),
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <header>
        <h1 className="text-xl font-semibold">Needs attention</h1>
        <p className="text-sm text-muted-foreground">
          Derived live from your records. Acknowledging an item records your
          decision — it changes nothing in the underlying module.
        </p>
      </header>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Reviewing the shop…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing is waiting on you in the records I can read.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const rec = recByCategory.get(item.reason);
            return (
              <li key={item.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={VARIANT[item.priority]} className="text-[10px]">
                        {item.priority}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {item.category.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="mt-1 font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.reason}</p>
                    {rec && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Suggested: {rec.title} ({rec.confidence} confidence)
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        run(() => repo.setAttentionStatus(item.id, "acknowledged"))
                      }
                    >
                      Acknowledge
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        run(() => repo.setAttentionStatus(item.id, "dismissed"))
                      }
                    >
                      Dismiss
                    </Button>
                    {canPropose && rec?.suggestedProposalType && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          run(() =>
                            repo.createProposal({
                              actionType: rec.suggestedProposalType!,
                              title: rec.title,
                              targets: item.sources,
                              reason: rec.reason,
                              evidence: item.evidence,
                              recommendationId: rec.id,
                            }),
                          )
                        }
                      >
                        Draft proposal
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
