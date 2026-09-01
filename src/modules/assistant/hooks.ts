// React hooks over the Jarvis service + AssistantRepository.
// Components import from here — never from ./data/local-repository, never
// from the model provider, and never from another module's repository.

import { useCallback, useEffect, useMemo, useState } from "react";
import { getRepository, subscribeRepository } from "@/core/data/registry";
import { useCapabilities } from "@/core/roles/hooks";
import { useIdentity } from "@/core/auth/identity";
import {
  ASSISTANT_REPOSITORY,
  type AssistantRepository,
} from "./data/repository";
import {
  askJarvis,
  getAttention,
  getDailyBrief,
  getRecommendations,
} from "./service";
import type {
  AiActionProposal,
  AttentionItem,
  DailyBrief,
  JarvisAnswer,
  ProposalListQuery,
  Recommendation,
} from "./data/schemas";

export function useAssistantRepository(): AssistantRepository {
  const [repo, setRepo] = useState<AssistantRepository>(() =>
    getRepository<AssistantRepository>(ASSISTANT_REPOSITORY),
  );
  useEffect(
    () =>
      subscribeRepository(ASSISTANT_REPOSITORY, () => {
        setRepo(getRepository<AssistantRepository>(ASSISTANT_REPOSITORY));
      }),
    [],
  );
  return repo;
}

function useRepoVersion(repo: AssistantRepository): number {
  const [v, setV] = useState(0);
  useEffect(() => repo.subscribe(() => setV((n) => n + 1)), [repo]);
  return v;
}

/** Capability check bound to the current identity's capabilities. */
function useCan(): (id: string) => boolean {
  const { can } = useCapabilities();
  return useCallback((id: string) => can(id), [can]);
}

export function useJarvisAttention() {
  const can = useCan();
  const repo = useAssistantRepository();
  const version = useRepoVersion(repo);
  const [data, setData] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    void getAttention({ can }).then((items) => {
      setData(items);
      setLoading(false);
    });
  }, [can]);

  useEffect(() => {
    load();
  }, [load, version]);

  return { data, loading, refresh: load };
}

export function useJarvisRecommendations() {
  const can = useCan();
  const repo = useAssistantRepository();
  const version = useRepoVersion(repo);
  const [data, setData] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    void getRecommendations({ can }).then((items) => {
      setData(items);
      setLoading(false);
    });
  }, [can]);

  useEffect(() => {
    load();
  }, [load, version]);

  return { data, loading, refresh: load };
}

export function useDailyBrief() {
  const can = useCan();
  const identity = useIdentity();
  const [data, setData] = useState<DailyBrief | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const displayName = identity.displayName;

  const load = useCallback(() => {
    setLoading(true);
    void getDailyBrief({ can, displayName }).then((brief) => {
      setData(brief);
      setLoading(false);
    });
  }, [can, displayName]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, refresh: load };
}

export function useAskJarvis() {
  const can = useCan();
  const [answer, setAnswer] = useState<JarvisAnswer | undefined>();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const ask = useCallback(
    async (question: string) => {
      setAsking(true);
      setError(undefined);
      try {
        const result = await askJarvis(question, { can });
        setAnswer(result);
        return result;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return undefined;
      } finally {
        setAsking(false);
      }
    },
    [can],
  );

  const reset = useCallback(() => setAnswer(undefined), []);

  return { ask, answer, asking, error, reset };
}

export function useProposals(query?: ProposalListQuery) {
  const repo = useAssistantRepository();
  const version = useRepoVersion(repo);
  const key = JSON.stringify(query ?? {});
  const [data, setData] = useState<AiActionProposal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    void repo.listProposals(query).then((rows) => {
      setData(rows);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, key]);

  useEffect(() => {
    load();
  }, [load, version]);

  return { data, loading, refresh: load };
}

/** Grouped counts used by the dashboard widget. */
export function useAttentionSummary() {
  const { data, loading } = useJarvisAttention();
  const counts = useMemo(() => {
    const byPriority = { urgent: 0, high: 0, normal: 0, low: 0 };
    for (const item of data) byPriority[item.priority] += 1;
    return byPriority;
  }, [data]);
  return { items: data, counts, loading };
}
