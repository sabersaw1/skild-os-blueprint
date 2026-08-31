// React hooks for the integration layer. UI never touches storage or
// adapters directly — it goes through the registered repository.

import { useCallback, useEffect, useState } from "react";
import { getRepository, subscribeRepository } from "@/core/data/registry";
import {
  INTEGRATIONS_REPOSITORY,
  type IntegrationRepository,
} from "./repository";
import type { IntegrationConnection, IntegrationSyncState } from "./types";

export function useIntegrationRepository(): IntegrationRepository {
  return getRepository<IntegrationRepository>(INTEGRATIONS_REPOSITORY);
}

export function useIntegrationConnections(): {
  connections: IntegrationConnection[];
  syncStates: IntegrationSyncState[];
  refresh: () => void;
  loading: boolean;
} {
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [syncStates, setSyncStates] = useState<IntegrationSyncState[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    const repo = getRepository<IntegrationRepository>(INTEGRATIONS_REPOSITORY);

    const load = () => {
      void Promise.all([repo.listConnections(), repo.listSyncStates()]).then(
        ([c, s]) => {
          if (cancelled) return;
          setConnections(c);
          setSyncStates(s);
          setLoading(false);
        },
      );
    };

    load();
    const unsubRepo = repo.subscribe(load);
    const unsubRegistry = subscribeRepository(INTEGRATIONS_REPOSITORY, load);
    return () => {
      cancelled = true;
      unsubRepo();
      unsubRegistry();
    };
  }, [tick]);

  return { connections, syncStates, refresh, loading };
}
