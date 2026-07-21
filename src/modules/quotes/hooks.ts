// React hooks over the registered QuotesRepository.
// Components import from here — never from ./data/local-repository.

import { useCallback, useEffect, useState } from "react";
import { getRepository, subscribeRepository } from "@/core/data/registry";
import {
  QUOTES_REPOSITORY,
  type QuotesRepository,
} from "./data/repository";
import type {
  Quote,
  QuoteListQuery,
  QuoteVersion,
} from "./data/schemas";

function useRepo(): QuotesRepository {
  const [repo, setRepo] = useState<QuotesRepository>(() =>
    getRepository<QuotesRepository>(QUOTES_REPOSITORY),
  );
  useEffect(
    () =>
      subscribeRepository(QUOTES_REPOSITORY, () => {
        setRepo(getRepository<QuotesRepository>(QUOTES_REPOSITORY));
      }),
    [],
  );
  return repo;
}

function useRepoVersion(repo: QuotesRepository): number {
  const [v, setV] = useState(0);
  useEffect(() => repo.subscribe(() => setV((n) => n + 1)), [repo]);
  return v;
}

export function useQuotesRepository(): QuotesRepository {
  return useRepo();
}

export function useQuotes(query?: QuoteListQuery): {
  data: Quote[];
  loading: boolean;
  refresh: () => void;
} {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  const [data, setData] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(query ?? {});
  const load = useCallback(() => {
    setLoading(true);
    void repo.listQuotes(query).then((items) => {
      setData(items);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, key]);
  useEffect(() => {
    load();
  }, [load, v]);
  return { data, loading, refresh: load };
}

export function useQuote(id: string | undefined): {
  data: Quote | undefined;
  loading: boolean;
} {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  const [data, setData] = useState<Quote | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!id) {
      setData(undefined);
      setLoading(false);
      return;
    }
    setLoading(true);
    void repo.getQuote(id).then((q) => {
      setData(q);
      setLoading(false);
    });
  }, [repo, id, v]);
  return { data, loading };
}

export function useQuoteVersions(quoteId: string | undefined): {
  data: QuoteVersion[];
  loading: boolean;
} {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  const [data, setData] = useState<QuoteVersion[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!quoteId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void repo.listVersions(quoteId).then((items) => {
      setData(items);
      setLoading(false);
    });
  }, [repo, quoteId, v]);
  return { data, loading };
}
