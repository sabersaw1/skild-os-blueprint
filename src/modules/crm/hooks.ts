// React hooks over the registered CustomerRepository.
// Components import from here — never from ./data/local-repository.

import { useCallback, useEffect, useState } from "react";
import { getRepository, subscribeRepository } from "@/core/data/registry";
import {
  CRM_CUSTOMER_REPOSITORY,
  type Customer,
  type CustomerListQuery,
  type CustomerRepository,
} from "./data/repository";

function useRepo(): CustomerRepository {
  const [repo, setRepo] = useState<CustomerRepository>(() =>
    getRepository<CustomerRepository>(CRM_CUSTOMER_REPOSITORY),
  );
  useEffect(
    () =>
      subscribeRepository(CRM_CUSTOMER_REPOSITORY, () => {
        setRepo(getRepository<CustomerRepository>(CRM_CUSTOMER_REPOSITORY));
      }),
    [],
  );
  return repo;
}

function useRepoVersion(repo: CustomerRepository): number {
  const [v, setV] = useState(0);
  useEffect(() => repo.subscribe(() => setV((n) => n + 1)), [repo]);
  return v;
}

export function useCustomerRepository(): CustomerRepository {
  return useRepo();
}

export function useCustomers(query?: CustomerListQuery): {
  data: Customer[];
  loading: boolean;
  refresh: () => void;
} {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  const [data, setData] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    void repo.list(query).then((r) => {
      setData(r.items);
      setLoading(false);
    });
  }, [repo, JSON.stringify(query ?? {})]);

  useEffect(() => {
    load();
  }, [load, v]);

  return { data, loading, refresh: load };
}

export function useCustomer(id: string | undefined): {
  data: Customer | undefined;
  loading: boolean;
} {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  const [data, setData] = useState<Customer | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!id) {
      setData(undefined);
      setLoading(false);
      return;
    }
    setLoading(true);
    void repo.get(id).then((c) => {
      setData(c);
      setLoading(false);
    });
  }, [repo, id, v]);
  return { data, loading };
}
