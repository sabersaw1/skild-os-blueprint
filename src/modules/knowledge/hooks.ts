// React hooks over the registered KnowledgeRepository.
// Components import from here — never from ./data/local-repository.

import { useCallback, useEffect, useState } from "react";
import { getRepository, subscribeRepository } from "@/core/data/registry";
import {
  KNOWLEDGE_REPOSITORY,
  type KnowledgeRepository,
} from "./data/repository";
import type {
  KnowledgeDocument,
  KnowledgeDocumentListQuery,
  KnowledgeLink,
  KnowledgeVersion,
} from "./data/schemas";

function useRepo(): KnowledgeRepository {
  const [repo, setRepo] = useState<KnowledgeRepository>(() =>
    getRepository<KnowledgeRepository>(KNOWLEDGE_REPOSITORY),
  );
  useEffect(
    () =>
      subscribeRepository(KNOWLEDGE_REPOSITORY, () => {
        setRepo(getRepository<KnowledgeRepository>(KNOWLEDGE_REPOSITORY));
      }),
    [],
  );
  return repo;
}

function useRepoVersion(repo: KnowledgeRepository): number {
  const [v, setV] = useState(0);
  useEffect(() => repo.subscribe(() => setV((n) => n + 1)), [repo]);
  return v;
}

export function useKnowledgeRepository(): KnowledgeRepository {
  return useRepo();
}

export function useKnowledgeDocuments(query?: KnowledgeDocumentListQuery): {
  data: KnowledgeDocument[];
  loading: boolean;
  refresh: () => void;
} {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  const [data, setData] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const key = JSON.stringify(query ?? {});
  const load = useCallback(() => {
    setLoading(true);
    void repo.listDocuments(query).then((items) => {
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

export function useKnowledgeDocument(id: string | undefined): {
  data: KnowledgeDocument | undefined;
  loading: boolean;
} {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  const [data, setData] = useState<KnowledgeDocument | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!id) {
      setData(undefined);
      setLoading(false);
      return;
    }
    setLoading(true);
    void repo.getDocument(id).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [repo, id, v]);
  return { data, loading };
}

export function useKnowledgeVersions(documentId: string | undefined): {
  data: KnowledgeVersion[];
  loading: boolean;
} {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  const [data, setData] = useState<KnowledgeVersion[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!documentId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void repo.listVersions(documentId).then((items) => {
      setData(items);
      setLoading(false);
    });
  }, [repo, documentId, v]);
  return { data, loading };
}

export function useKnowledgeLinks(knowledgeId: string | undefined): {
  data: KnowledgeLink[];
  loading: boolean;
} {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  const [data, setData] = useState<KnowledgeLink[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!knowledgeId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void repo.listLinks({ knowledgeId }).then((items) => {
      setData(items);
      setLoading(false);
    });
  }, [repo, knowledgeId, v]);
  return { data, loading };
}
