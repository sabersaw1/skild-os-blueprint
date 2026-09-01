// React hooks over the registered AutomationRepository.
// Components import from here — never from ./data/local-repository.

import { useCallback, useEffect, useState } from "react";
import { getRepository, subscribeRepository } from "@/core/data/registry";
import {
  AUTOMATION_REPOSITORY,
  type AutomationRepository,
} from "./data/repository";
import type {
  ActionListQuery,
  Agent,
  AgentAction,
  AgentRun,
  Approval,
  AutomationOverview,
  AutomationRule,
  RunListQuery,
} from "./data/schemas";

function useRepo(): AutomationRepository {
  const [repo, setRepo] = useState<AutomationRepository>(() =>
    getRepository<AutomationRepository>(AUTOMATION_REPOSITORY),
  );
  useEffect(
    () =>
      subscribeRepository(AUTOMATION_REPOSITORY, () => {
        setRepo(getRepository<AutomationRepository>(AUTOMATION_REPOSITORY));
      }),
    [],
  );
  return repo;
}

function useRepoVersion(repo: AutomationRepository): number {
  const [v, setV] = useState(0);
  useEffect(() => repo.subscribe(() => setV((n) => n + 1)), [repo]);
  return v;
}

export function useAutomationRepository(): AutomationRepository {
  return useRepo();
}

function useAsync<T>(
  repo: AutomationRepository,
  version: number,
  loader: () => Promise<T>,
  initial: T,
  key: string,
): { data: T; loading: boolean; refresh: () => void } {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    void loader().then((result) => {
      setData(result);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, key]);
  useEffect(() => {
    load();
  }, [load, version]);
  return { data, loading, refresh: load };
}

export function useAgents() {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<Agent[]>(repo, v, () => repo.listAgents(), [], "agents");
}

export function useAutomationRules(agentId?: string) {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<AutomationRule[]>(
    repo,
    v,
    () => repo.listRules(agentId),
    [],
    `rules:${agentId ?? "all"}`,
  );
}

export function useAgentRuns(query?: RunListQuery) {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<AgentRun[]>(
    repo,
    v,
    () => repo.listRuns(query),
    [],
    `runs:${JSON.stringify(query ?? {})}`,
  );
}

export function useAgentActions(query?: ActionListQuery) {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<AgentAction[]>(
    repo,
    v,
    () => repo.listActions(query),
    [],
    `actions:${JSON.stringify(query ?? {})}`,
  );
}

export function usePendingApprovals() {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<Approval[]>(
    repo,
    v,
    () => repo.listApprovals("pending"),
    [],
    "approvals:pending",
  );
}

const EMPTY_OVERVIEW: AutomationOverview = {
  activeAgents: 0,
  activeAutomations: 0,
  pendingApprovals: 0,
  failedRuns: 0,
  completedRunsToday: 0,
  blockedActions: 0,
  runningRuns: 0,
};

export function useAutomationOverview() {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<AutomationOverview>(
    repo,
    v,
    () => repo.getOverview(),
    EMPTY_OVERVIEW,
    "overview",
  );
}
