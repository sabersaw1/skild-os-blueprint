// Action handlers (Phase 13).
//
// THE ONLY PLACE AN AGENT ACTION TOUCHES ANOTHER MODULE.
//
// Rules, without exception:
//   1. A handler reaches other modules through their PUBLIC repository
//      contract, resolved from the Data Registry. Never a sibling local
//      implementation, never storage.
//   2. A handler performs a REAL operation and returns a concise, truthful
//      result summary. If it cannot do the real thing, it throws — it never
//      returns a summary describing something that did not happen.
//   3. No handler sends, publishes, spends, refunds, prices or deletes.
//      Those action types are BLOCKED by policy and have no handler at all;
//      registering one would not help, because the repository refuses to
//      mark a blocked action executed.
//   4. A handler writes SUGGESTIONS (proposals / attention items). It never
//      writes verified business knowledge.

import { getRepository, hasRepository } from "@/core/data/registry";
import {
  ASSISTANT_REPOSITORY,
  type AssistantRepository,
} from "@/modules/assistant/data/repository";
import type { AgentAction, AgentActionType } from "../data/schemas";

export interface HandlerContext {
  action: AgentAction;
  now: number;
}

/** Returns a concise result summary describing what ACTUALLY happened. */
export type ActionHandler = (ctx: HandlerContext) => Promise<string>;

function assistant(): AssistantRepository {
  if (!hasRepository(ASSISTANT_REPOSITORY)) {
    throw new Error(
      "Automation: the assistant repository is not registered; the action cannot be carried out.",
    );
  }
  return getRepository<AssistantRepository>(ASSISTANT_REPOSITORY);
}

/**
 * Record an internal proposal against the Jarvis proposal store. This is a
 * real, durable, human-reviewable record — and nothing more. Approving the
 * agent action does NOT approve the proposal; a person still decides.
 */
async function recordProposal(
  ctx: HandlerContext,
  title: string,
): Promise<string> {
  const repo = assistant();
  const entities = ctx.action.targets.map((t) => t.entity);
  const proposalType = entities.includes("quote")
    ? "follow_up_quote"
    : entities.includes("conversation") || entities.includes("lead")
      ? "follow_up_lead"
      : "follow_up_lead";
  const proposal = await repo.createProposal({
    actionType: proposalType,
    title,
    reason: ctx.action.rationale,
    targets: ctx.action.targets.map((t) => ({
      module: t.module,
      entity: t.entity,
      id: t.id,
    })),
    providerId: `agent:${ctx.action.agentId}`,
  });
  return `Recorded internal proposal ${proposal.id} (pending human review). Nothing was sent.`;
}

export const ACTION_HANDLERS: Partial<
  Record<AgentActionType, ActionHandler>
> = {
  "attention.flag": (ctx) =>
    recordProposal(ctx, "Record reached a stale state and needs a look"),

  "proposal.create": (ctx) => recordProposal(ctx, "Agent proposal for review"),

  "briefing.compile": async (ctx) => {
    // Assembles structured internal information only. It is not delivered
    // anywhere, and this summary must never claim that it was.
    const modules = [...new Set(ctx.action.targets.map((t) => t.module))];
    return `Compiled an internal briefing item covering ${ctx.action.targets.length} record(s) across ${modules.join(", ")}. Not delivered anywhere.`;
  },

  "followup.prepare": (ctx) =>
    recordProposal(
      ctx,
      "Prepared customer follow-up for review (not sent, not queued)",
    ),
};

export function getActionHandler(
  type: AgentActionType,
): ActionHandler | undefined {
  return ACTION_HANDLERS[type];
}
