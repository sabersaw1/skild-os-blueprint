// React hooks over the registered PartsRepository.
// Components import from here — never from ./data/local-repository.

import { useCallback, useEffect, useState } from "react";
import { getRepository, subscribeRepository } from "@/core/data/registry";
import { PARTS_REPOSITORY, type PartsRepository } from "./data/repository";
import type {
  Part,
  PartListQuery,
  PartUsage,
  PartUsageQuery,
  PartVehicleReference,
  Purchase,
  PurchaseLine,
  PurchaseListQuery,
  Supplier,
} from "./data/schemas";

function useRepo(): PartsRepository {
  const [repo, setRepo] = useState<PartsRepository>(() =>
    getRepository<PartsRepository>(PARTS_REPOSITORY),
  );
  useEffect(
    () =>
      subscribeRepository(PARTS_REPOSITORY, () => {
        setRepo(getRepository<PartsRepository>(PARTS_REPOSITORY));
      }),
    [],
  );
  return repo;
}

function useRepoVersion(repo: PartsRepository): number {
  const [v, setV] = useState(0);
  useEffect(() => repo.subscribe(() => setV((n) => n + 1)), [repo]);
  return v;
}

export function usePartsRepository(): PartsRepository {
  return useRepo();
}

function useAsync<T>(
  repo: PartsRepository,
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

export function useParts(query?: PartListQuery) {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  const key = JSON.stringify(query ?? {});
  const { data, loading, refresh } = useAsync<Part[]>(
    repo,
    v,
    () => repo.listParts(query).then((r) => r.items),
    [],
    key,
  );
  return { data, loading, refresh };
}

export function usePart(id: string | undefined) {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<Part | undefined>(
    repo,
    v,
    () => (id ? repo.getPart(id) : Promise.resolve(undefined)),
    undefined,
    id ?? "",
  );
}

export function useSuppliers() {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<Supplier[]>(repo, v, () => repo.listSuppliers(), [], "all");
}

export function usePurchases(query?: PurchaseListQuery) {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  const key = JSON.stringify(query ?? {});
  return useAsync<Purchase[]>(
    repo,
    v,
    () => repo.listPurchases(query).then((r) => r.items),
    [],
    key,
  );
}

export function usePurchase(id: string | undefined) {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<Purchase | undefined>(
    repo,
    v,
    () => (id ? repo.getPurchase(id) : Promise.resolve(undefined)),
    undefined,
    id ?? "",
  );
}

export function usePurchaseLines(purchaseId: string | undefined) {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<PurchaseLine[]>(
    repo,
    v,
    () =>
      purchaseId ? repo.listPurchaseLines(purchaseId) : Promise.resolve([]),
    [],
    purchaseId ?? "",
  );
}

export function usePartUsage(query?: PartUsageQuery) {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  const key = JSON.stringify(query ?? {});
  return useAsync<PartUsage[]>(repo, v, () => repo.listUsage(query), [], key);
}

export function usePartVehicleReferences(partId: string | undefined) {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<PartVehicleReference[]>(
    repo,
    v,
    () => (partId ? repo.listVehicleReferences(partId) : Promise.resolve([])),
    [],
    partId ?? "",
  );
}
