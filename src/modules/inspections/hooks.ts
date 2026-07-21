// React hooks over the registered InspectionsRepository.
// Components import from here — never from ./data/local-repository.

import { useCallback, useEffect, useState } from "react";
import { getRepository, subscribeRepository } from "@/core/data/registry";
import {
  INSPECTIONS_REPOSITORY,
  type InspectionsRepository,
} from "./data/repository";
import type {
  Inspection,
  InspectionFinding,
  InspectionListQuery,
  InspectionPhoto,
  InspectionTemplate,
} from "./data/schemas";

function useRepo(): InspectionsRepository {
  const [repo, setRepo] = useState<InspectionsRepository>(() =>
    getRepository<InspectionsRepository>(INSPECTIONS_REPOSITORY),
  );
  useEffect(
    () =>
      subscribeRepository(INSPECTIONS_REPOSITORY, () => {
        setRepo(getRepository<InspectionsRepository>(INSPECTIONS_REPOSITORY));
      }),
    [],
  );
  return repo;
}

function useRepoVersion(repo: InspectionsRepository): number {
  const [v, setV] = useState(0);
  useEffect(() => repo.subscribe(() => setV((n) => n + 1)), [repo]);
  return v;
}

export function useInspectionsRepository(): InspectionsRepository {
  return useRepo();
}

export function useInspections(query?: InspectionListQuery): {
  data: Inspection[];
  loading: boolean;
  refresh: () => void;
} {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  const [data, setData] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(query ?? {});
  const load = useCallback(() => {
    setLoading(true);
    void repo.listInspections(query).then((items) => {
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

export function useInspection(id: string | undefined): {
  data: Inspection | undefined;
  loading: boolean;
} {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  const [data, setData] = useState<Inspection | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!id) {
      setData(undefined);
      setLoading(false);
      return;
    }
    setLoading(true);
    void repo.getInspection(id).then((i) => {
      setData(i);
      setLoading(false);
    });
  }, [repo, id, v]);
  return { data, loading };
}

export function useFindings(inspectionId: string | undefined): {
  data: InspectionFinding[];
  loading: boolean;
} {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  const [data, setData] = useState<InspectionFinding[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!inspectionId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void repo.listFindings(inspectionId).then((items) => {
      setData(items);
      setLoading(false);
    });
  }, [repo, inspectionId, v]);
  return { data, loading };
}

export function useInspectionPhotos(inspectionId: string | undefined): {
  data: InspectionPhoto[];
  loading: boolean;
} {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  const [data, setData] = useState<InspectionPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!inspectionId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void repo.listPhotos(inspectionId).then((items) => {
      setData(items);
      setLoading(false);
    });
  }, [repo, inspectionId, v]);
  return { data, loading };
}

export function useInspectionTemplates(): {
  data: InspectionTemplate[];
  loading: boolean;
} {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  const [data, setData] = useState<InspectionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    void repo.listTemplates().then((items) => {
      setData(items);
      setLoading(false);
    });
  }, [repo, v]);
  return { data, loading };
}
