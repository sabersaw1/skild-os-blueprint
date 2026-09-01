// Jarvis service — the single coordination point for "Ask Jarvis".
//
// Flow (fixed order, no shortcuts):
//   question → classify intent → resolve grounded context (capability-gated
//   tool calls only) → derive attention → derive recommendations → hand the
//   grounded context to the model provider for wording → assemble an answer
//   that carries its facts, sources, uncertainty, and capability gaps.
//
// HARD BOUNDARIES
//   • The provider never touches a repository, storage, or a credential.
//     It sees the resolved context and nothing else.
//   • Nothing in this file writes a business record. The only writes Jarvis
//     can make are proposals and attention acknowledgements, through the
//     assistant repository, and neither performs the action.
//   • A missing capability removes a section and is DECLARED. It is never
//     silently rendered as zero.

import { newId } from "@/core/ids";
import { emit } from "@/core/activity/emitter";
import { getRepository, hasRepository } from "@/core/data/registry";
import { ASSISTANT_EVENTS } from "./activity";
import { classifyIntent } from "./intent/classify";
import { resolveContext } from "./context/resolver";
import { buildAttentionItems } from "./engine/attention";
import { recommendationsFromAttention } from "./engine/recommendations";
import { buildDailyBrief } from "./engine/brief";
import { createJarvisTools, type CapabilityCheck } from "./tools";
import { getModelProvider } from "./provider/registry";
import { ASSISTANT_REPOSITORY, type AssistantRepository } from "./data/repository";
import {
  JARVIS_READ,
  JARVIS_RECOMMEND,
} from "./capabilities";
import type {
  AttentionItem,
  DailyBrief,
  JarvisAnswer,
  Recommendation,
} from "./data/schemas";

export interface JarvisServiceOptions {
  can: CapabilityCheck;
  now?: number;
  displayName?: string;
}

function repo(): AssistantRepository | undefined {
  return hasRepository(ASSISTANT_REPOSITORY)
    ? getRepository<AssistantRepository>(ASSISTANT_REPOSITORY)
    : undefined;
}

async function acknowledgements() {
  try {
    return (await repo()?.listAcknowledgements()) ?? [];
  } catch {
    return [];
  }
}

export async function getAttention(opts: JarvisServiceOptions): Promise<AttentionItem[]> {
  if (!opts.can(JARVIS_READ)) return [];
  return buildAttentionItems({
    tools: createJarvisTools(opts.can),
    now: opts.now,
    acknowledgements: await acknowledgements(),
  });
}

export async function getRecommendations(
  opts: JarvisServiceOptions,
): Promise<Recommendation[]> {
  if (!opts.can(JARVIS_RECOMMEND)) return [];
  const items = await getAttention(opts);
  return recommendationsFromAttention(items, { now: opts.now });
}

export async function getDailyBrief(opts: JarvisServiceOptions): Promise<DailyBrief> {
  const now = opts.now ?? Date.now();
  if (!opts.can(JARVIS_READ)) {
    return {
      generatedAt: now,
      greeting: "Good morning",
      sections: [],
      attentionCount: 0,
      omitted: ["Everything — the jarvis.read capability is required."],
    };
  }
  const attention = await getAttention(opts);
  const brief = await buildDailyBrief({
    tools: createJarvisTools(opts.can),
    now,
    attentionCount: attention.length,
    displayName: opts.displayName,
  });
  // NOTE: the brief is rendered on every visit. Emitting an activity event
  // per render would flood the log with noise, so `assistant.brief.generated`
  // is reserved for an explicitly requested brief (a command or a schedule),
  // not for passive rendering.
  return brief;
}

export async function askJarvis(
  question: string,
  opts: JarvisServiceOptions & {
    entityIds?: { customerId?: string; vehicleId?: string; jobId?: string };
  },
): Promise<JarvisAnswer> {
  const now = opts.now ?? Date.now();
  const provider = getModelProvider();
  const intent = classifyIntent(question);

  if (!opts.can(JARVIS_READ)) {
    return {
      id: newId(),
      question,
      intent: intent.type,
      intentConfidence: intent.confidence,
      summary:
        "I can't answer that: asking Jarvis requires the jarvis.read capability.",
      facts: [],
      recommendations: [],
      attention: [],
      knowledge: [],
      uncertainty: ["No business data was read, so nothing here is grounded."],
      blockedByCapabilities: [JARVIS_READ],
      providerId: provider.id,
      generatedAt: now,
    };
  }

  const tools = createJarvisTools(opts.can);
  const context = await resolveContext({
    intent,
    question,
    tools,
    now,
    entityIds: opts.entityIds,
  });

  const wantsAttention =
    intent.type === "operational.attention" || intent.type === "brief.daily";
  const attention = wantsAttention
    ? await buildAttentionItems({
        tools,
        now,
        acknowledgements: await acknowledgements(),
      })
    : [];

  const recommendations = opts.can(JARVIS_RECOMMEND)
    ? recommendationsFromAttention(
        attention.length
          ? attention
          : await buildAttentionItems({
              tools,
              now,
              acknowledgements: await acknowledgements(),
            }),
        { now, limit: 4 },
      )
    : [];

  const uncertainty = [...context.uncertainty];
  if (!opts.can(JARVIS_RECOMMEND)) {
    uncertainty.push(
      "Recommendations were omitted: they require the jarvis.recommend capability.",
    );
  }
  if (intent.type === "unknown") {
    uncertainty.push(
      "I could not map that question to something I know how to look up, so this answer may be incomplete.",
    );
  }

  // The provider sees the grounded context only — no repositories, no
  // storage, no credentials, and no records beyond these facts.
  const completion = await provider.complete({
    question,
    intent: intent.type,
    facts: context.facts,
    recommendations,
    knowledge: context.knowledge,
    uncertainty,
  });

  const answer: JarvisAnswer = {
    id: newId(),
    question,
    intent: intent.type,
    intentConfidence: intent.confidence,
    summary: completion.summary,
    facts: context.facts,
    recommendations,
    attention,
    knowledge: context.knowledge,
    uncertainty: [...uncertainty, ...(completion.uncertainty ?? [])],
    blockedByCapabilities: context.blockedByCapabilities,
    providerId: provider.id,
    generatedAt: now,
  };

  // Activity payloads carry shape, never the question text or any customer
  // detail (see docs/activity-events.md).
  emit({
    type: ASSISTANT_EVENTS.queryExecuted,
    moduleId: "assistant",
    summary: `Jarvis answered a "${intent.type}" question`,
    payload: {
      intent: intent.type,
      intentConfidence: intent.confidence,
      factCount: answer.facts.length,
      recommendationCount: answer.recommendations.length,
      uncertaintyCount: answer.uncertainty.length,
      blockedCount: answer.blockedByCapabilities.length,
      providerId: provider.id,
    },
  });

  if (answer.recommendations.length) {
    emit({
      type: ASSISTANT_EVENTS.recommendationCreated,
      moduleId: "assistant",
      summary: `Jarvis surfaced ${answer.recommendations.length} recommendation(s)`,
      payload: { count: answer.recommendations.length, intent: intent.type },
    });
  }

  return answer;
}
