// React hooks over the registered MarketingRepository.
// Components import from here — never from ./data/local-repository.

import { useCallback, useEffect, useState } from "react";
import { getRepository, subscribeRepository } from "@/core/data/registry";
import {
  MARKETING_REPOSITORY,
  type MarketingRepository,
} from "./data/repository";
import type {
  Lead,
  LeadAttentionItem,
  LeadListQuery,
  MarketingAction,
  MarketingActionListQuery,
  MarketingOpportunity,
  MarketingOpportunityListQuery,
  RetentionOpportunity,
  SearchOpportunityRecord,
  ServicePerformance,
  SourcePerformance,
} from "./data/schemas";

function useRepo(): MarketingRepository {
  const [repo, setRepo] = useState<MarketingRepository>(() =>
    getRepository<MarketingRepository>(MARKETING_REPOSITORY),
  );
  useEffect(
    () =>
      subscribeRepository(MARKETING_REPOSITORY, () => {
        setRepo(getRepository<MarketingRepository>(MARKETING_REPOSITORY));
      }),
    [],
  );
  return repo;
}

function useRepoVersion(repo: MarketingRepository): number {
  const [v, setV] = useState(0);
  useEffect(() => repo.subscribe(() => setV((n) => n + 1)), [repo]);
  return v;
}

export function useMarketingRepository(): MarketingRepository {
  return useRepo();
}

function useAsync<T>(
  repo: MarketingRepository,
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

export function useLeads(query?: LeadListQuery) {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<Lead[]>(
    repo,
    v,
    () => repo.listLeads(query),
    [],
    JSON.stringify(query ?? {}),
  );
}

export function useLead(id: string | undefined) {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<Lead | undefined>(
    repo,
    v,
    () => (id ? repo.getLead(id) : Promise.resolve(undefined)),
    undefined,
    id ?? "",
  );
}

export function useLeadsNeedingAttention() {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<LeadAttentionItem[]>(
    repo,
    v,
    () => repo.listLeadsNeedingAttention(),
    [],
    "attention",
  );
}

export function useMarketingOpportunities(
  query?: MarketingOpportunityListQuery,
) {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<MarketingOpportunity[]>(
    repo,
    v,
    () => repo.listOpportunities(query),
    [],
    JSON.stringify(query ?? {}),
  );
}

export function useMarketingActions(query?: MarketingActionListQuery) {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<MarketingAction[]>(
    repo,
    v,
    () => repo.listActions(query),
    [],
    JSON.stringify(query ?? {}),
  );
}

export function useSourcePerformance() {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<SourcePerformance[]>(
    repo,
    v,
    () => repo.getSourcePerformance(),
    [],
    "source-performance",
  );
}

export function useServicePerformance() {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<ServicePerformance[]>(
    repo,
    v,
    () => repo.getServicePerformance(),
    [],
    "service-performance",
  );
}

export function useSearchOpportunities() {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<SearchOpportunityRecord[]>(
    repo,
    v,
    () => repo.listSearchOpportunities(),
    [],
    "search-opportunities",
  );
}

export function useRetentionOpportunities() {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<RetentionOpportunity[]>(
    repo,
    v,
    () => repo.listRetentionOpportunities(),
    [],
    "retention",
  );
}
