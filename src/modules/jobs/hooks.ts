// React hooks over the registered JobsRepository.
// Components import from here — never from ./data/local-repository.

import { useCallback, useEffect, useState } from "react";
import { getRepository, subscribeRepository } from "@/core/data/registry";
import {
  JOBS_REPOSITORY,
  type JobsRepository,
} from "./data/repository";
import type {
  Job,
  JobListQuery,
  JobNote,
  JobStatusHistory,
  LaborEntry,
} from "./data/schemas";

function useRepo(): JobsRepository {
  const [repo, setRepo] = useState<JobsRepository>(() =>
    getRepository<JobsRepository>(JOBS_REPOSITORY),
  );
  useEffect(
    () =>
      subscribeRepository(JOBS_REPOSITORY, () => {
        setRepo(getRepository<JobsRepository>(JOBS_REPOSITORY));
      }),
    [],
  );
  return repo;
}

function useRepoVersion(repo: JobsRepository): number {
  const [v, setV] = useState(0);
  useEffect(() => repo.subscribe(() => setV((n) => n + 1)), [repo]);
  return v;
}

export function useJobsRepository(): JobsRepository {
  return useRepo();
}

export function useJobs(query?: JobListQuery): {
  data: Job[];
  loading: boolean;
  refresh: () => void;
} {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  const [data, setData] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(query ?? {});
  const load = useCallback(() => {
    setLoading(true);
    void repo.list(query).then((items) => {
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

export function useJob(id: string | undefined): {
  data: Job | undefined;
  loading: boolean;
} {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  const [data, setData] = useState<Job | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!id) {
      setData(undefined);
      setLoading(false);
      return;
    }
    setLoading(true);
    void repo.get(id).then((j) => {
      setData(j);
      setLoading(false);
    });
  }, [repo, id, v]);
  return { data, loading };
}

export function useJobStatusHistory(jobId: string | undefined): {
  data: JobStatusHistory[];
  loading: boolean;
} {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  const [data, setData] = useState<JobStatusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!jobId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void repo.listStatusHistory(jobId).then((items) => {
      setData(items);
      setLoading(false);
    });
  }, [repo, jobId, v]);
  return { data, loading };
}

export function useJobLabor(jobId: string | undefined): {
  data: LaborEntry[];
  loading: boolean;
} {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  const [data, setData] = useState<LaborEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!jobId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void repo.listLabor(jobId).then((items) => {
      setData(items);
      setLoading(false);
    });
  }, [repo, jobId, v]);
  return { data, loading };
}

export function useJobNotes(jobId: string | undefined): {
  data: JobNote[];
  loading: boolean;
} {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  const [data, setData] = useState<JobNote[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!jobId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void repo.listNotes(jobId).then((items) => {
      setData(items);
      setLoading(false);
    });
  }, [repo, jobId, v]);
  return { data, loading };
}
