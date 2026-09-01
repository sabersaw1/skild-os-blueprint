// React hooks over the registered IntelligenceRepository.
// Components import from here — never from ./data/local-repository, and
// never from another module's local repository.

import { useCallback, useEffect, useMemo, useState } from "react";
import { getRepository, subscribeRepository } from "@/core/data/registry";
import {
  INTELLIGENCE_REPOSITORY,
  type IntelligenceRepository,
} from "./data/repository";
import { lastDays } from "./data/read-models";
import type {
  AttentionItem,
  ComparisonReport,
  IntelligenceOpportunity,
  IntelligenceOverview,
  MetricSnapshot,
  Observation,
  Period,
  Recommendation,
  ServicePerformanceRow,
  SourcePerformanceRow,
} from "./data/schemas";

function useRepo(): IntelligenceRepository {
  const [repo, setRepo] = useState<IntelligenceRepository>(() =>
    getRepository<IntelligenceRepository>(INTELLIGENCE_REPOSITORY),
  );
  useEffect(
    () =>
      subscribeRepository(INTELLIGENCE_REPOSITORY, () => {
        setRepo(getRepository<IntelligenceRepository>(INTELLIGENCE_REPOSITORY));
      }),
    [],
  );
  return repo;
}

function useRepoVersion(repo: IntelligenceRepository): number {
  const [v, setV] = useState(0);
  useEffect(() => repo.subscribe(() => setV((n) => n + 1)), [repo]);
  return v;
}

function useAsync<T>(
  repo: IntelligenceRepository,
  version: number,
  loader: () => Promise<T>,
  initial: T,
  key: string,
): { data: T; loading: boolean; error?: string; refresh: () => void } {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const load = useCallback(() => {
    setLoading(true);
    void loader()
      .then((result) => {
        setData(result);
        setError(undefined);
      })
      .catch((e: unknown) => {
        // Surfaced honestly in the UI — never rendered as an empty result.
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, key]);
  useEffect(() => {
    load();
  }, [load, version]);
  return { data, loading, error, refresh: load };
}

export function useIntelligenceRepository(): IntelligenceRepository {
  return useRepo();
}

/** Stable period covering the last `days` days; recomputed only on change. */
export function usePeriod(days: number): Period {
  return useMemo(() => lastDays(days), [days]);
}

const periodKey = (p: Period) => `${p.start}-${p.end}`;

export function useIntelligenceOverview(period: Period) {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<IntelligenceOverview | undefined>(
    repo,
    v,
    () => repo.getOverview(period),
    undefined,
    `overview:${periodKey(period)}`,
  );
}

export function useIntelligenceComparison(period: Period) {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<ComparisonReport | undefined>(
    repo,
    v,
    () => repo.getComparison(period),
    undefined,
    `comparison:${periodKey(period)}`,
  );
}

export function useIntelligenceAttention() {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<AttentionItem[]>(repo, v, () => repo.getAttention(), [], "attention");
}

export function useServicePerformanceRows(period: Period) {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<ServicePerformanceRow[]>(
    repo,
    v,
    () => repo.getServicePerformance(period),
    [],
    `service:${periodKey(period)}`,
  );
}

export function useSourcePerformanceRows(period: Period) {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<SourcePerformanceRow[]>(
    repo,
    v,
    () => repo.getSourcePerformance(period),
    [],
    `source:${periodKey(period)}`,
  );
}

export function useObservations() {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<Observation[]>(repo, v, () => repo.listObservations(), [], "observations");
}

export function useIntelligenceOpportunities() {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<IntelligenceOpportunity[]>(
    repo,
    v,
    () => repo.listOpportunities(),
    [],
    "opportunities",
  );
}

export function useIntelligenceRecommendations() {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<Recommendation[]>(
    repo,
    v,
    () => repo.listRecommendations(),
    [],
    "recommendations",
  );
}

export function useMetricSnapshots(limit = 50) {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<MetricSnapshot[]>(
    repo,
    v,
    () => repo.listSnapshots({ limit }),
    [],
    `snapshots:${limit}`,
  );
}
