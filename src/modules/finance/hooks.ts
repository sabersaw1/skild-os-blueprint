// React hooks over the registered FinanceRepository.
// Components import from here — never from ./data/local-repository.

import { useCallback, useEffect, useState } from "react";
import { getRepository, subscribeRepository } from "@/core/data/registry";
import { FINANCE_REPOSITORY, type FinanceRepository } from "./data/repository";
import type {
  Invoice,
  InvoiceListQuery,
  InvoiceSnapshot,
  Payment,
} from "./data/schemas";

function useRepo(): FinanceRepository {
  const [repo, setRepo] = useState<FinanceRepository>(() =>
    getRepository<FinanceRepository>(FINANCE_REPOSITORY),
  );
  useEffect(
    () =>
      subscribeRepository(FINANCE_REPOSITORY, () => {
        setRepo(getRepository<FinanceRepository>(FINANCE_REPOSITORY));
      }),
    [],
  );
  return repo;
}

function useRepoVersion(repo: FinanceRepository): number {
  const [v, setV] = useState(0);
  useEffect(() => repo.subscribe(() => setV((n) => n + 1)), [repo]);
  return v;
}

export function useFinanceRepository(): FinanceRepository {
  return useRepo();
}

function useAsync<T>(
  repo: FinanceRepository,
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

export function useInvoices(query?: InvoiceListQuery) {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  const key = JSON.stringify(query ?? {});
  return useAsync<Invoice[]>(repo, v, () => repo.listInvoices(query), [], key);
}

export function useInvoice(id: string | undefined) {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<Invoice | undefined>(
    repo,
    v,
    () => (id ? repo.getInvoice(id) : Promise.resolve(undefined)),
    undefined,
    id ?? "",
  );
}

export function useInvoicePayments(invoiceId: string | undefined) {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<Payment[]>(
    repo,
    v,
    () => (invoiceId ? repo.listPayments(invoiceId) : Promise.resolve([])),
    [],
    invoiceId ?? "",
  );
}

export function useInvoiceSnapshots(invoiceId: string | undefined) {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<InvoiceSnapshot[]>(
    repo,
    v,
    () => (invoiceId ? repo.listSnapshots(invoiceId) : Promise.resolve([])),
    [],
    invoiceId ?? "",
  );
}
