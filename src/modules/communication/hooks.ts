// React hooks over the registered CommunicationRepository.
// Components import from here — never from ./data/local-repository.

import { useCallback, useEffect, useState } from "react";
import { getRepository, subscribeRepository } from "@/core/data/registry";
import {
  COMMUNICATION_REPOSITORY,
  type CommunicationRepository,
} from "./data/repository";
import type {
  Conversation,
  ConversationListQuery,
  CustomerCommunicationContext,
  Message,
  MessageListQuery,
  ReviewRequest,
  ServiceRequest,
  ServiceRequestListQuery,
} from "./data/schemas";

function useRepo(): CommunicationRepository {
  const [repo, setRepo] = useState<CommunicationRepository>(() =>
    getRepository<CommunicationRepository>(COMMUNICATION_REPOSITORY),
  );
  useEffect(
    () =>
      subscribeRepository(COMMUNICATION_REPOSITORY, () => {
        setRepo(
          getRepository<CommunicationRepository>(COMMUNICATION_REPOSITORY),
        );
      }),
    [],
  );
  return repo;
}

function useRepoVersion(repo: CommunicationRepository): number {
  const [v, setV] = useState(0);
  useEffect(() => repo.subscribe(() => setV((n) => n + 1)), [repo]);
  return v;
}

export function useCommunicationRepository(): CommunicationRepository {
  return useRepo();
}

function useAsync<T>(
  repo: CommunicationRepository,
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

export function useConversations(query?: ConversationListQuery) {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  const key = JSON.stringify(query ?? {});
  return useAsync<Conversation[]>(
    repo,
    v,
    () => repo.listConversations(query),
    [],
    key,
  );
}

export function useConversation(id: string | undefined) {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<Conversation | undefined>(
    repo,
    v,
    () => (id ? repo.getConversation(id) : Promise.resolve(undefined)),
    undefined,
    id ?? "",
  );
}

export function useMessages(query?: MessageListQuery) {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  const key = JSON.stringify(query ?? {});
  return useAsync<Message[]>(repo, v, () => repo.listMessages(query), [], key);
}

export function useServiceRequests(query?: ServiceRequestListQuery) {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  const key = JSON.stringify(query ?? {});
  return useAsync<ServiceRequest[]>(
    repo,
    v,
    () => repo.listServiceRequests(query),
    [],
    key,
  );
}

export function useReviewRequests(customerId?: string) {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<ReviewRequest[]>(
    repo,
    v,
    () => repo.listReviewRequests(customerId),
    [],
    customerId ?? "",
  );
}

export function useCustomerCommunicationContext(customerId: string | undefined) {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  return useAsync<CustomerCommunicationContext | undefined>(
    repo,
    v,
    () =>
      customerId
        ? repo.getCustomerContext(customerId)
        : Promise.resolve(undefined),
    undefined,
    customerId ?? "",
  );
}
