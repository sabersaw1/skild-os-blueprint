import { useCallback, useEffect, useState } from "react";
import { getRepository, subscribeRepository } from "@/core/data/registry";
import {
  VEHICLES_REPOSITORY,
  type Vehicle,
  type VehicleListQuery,
  type VehicleRepository,
} from "./data/repository";

function useRepo(): VehicleRepository {
  const [repo, setRepo] = useState<VehicleRepository>(() =>
    getRepository<VehicleRepository>(VEHICLES_REPOSITORY),
  );
  useEffect(
    () =>
      subscribeRepository(VEHICLES_REPOSITORY, () => {
        setRepo(getRepository<VehicleRepository>(VEHICLES_REPOSITORY));
      }),
    [],
  );
  return repo;
}

function useRepoVersion(repo: VehicleRepository): number {
  const [v, setV] = useState(0);
  useEffect(() => repo.subscribe(() => setV((n) => n + 1)), [repo]);
  return v;
}

export function useVehicleRepository(): VehicleRepository {
  return useRepo();
}

export function useVehicles(query?: VehicleListQuery): {
  data: Vehicle[];
  loading: boolean;
  refresh: () => void;
} {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  const [data, setData] = useState<Vehicle[]>([]);
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

export function useVehicle(id: string | undefined): {
  data: Vehicle | undefined;
  loading: boolean;
} {
  const repo = useRepo();
  const v = useRepoVersion(repo);
  const [data, setData] = useState<Vehicle | undefined>(undefined);
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
