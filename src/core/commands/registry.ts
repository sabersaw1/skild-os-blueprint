// Command registry for the Command Bar.
// Modules register commands via `registerCommand`. The Command Bar reads
// them through `useCommands` and filters by the current identity's role.

import { createStore } from "../store";
import { hasAll } from "../roles/roles";
import { getIdentity } from "../auth/identity";

export type Command = {
  id: string;
  label: string;
  group?: string;
  keywords?: string[];
  requiredCapabilityIds?: string[];
  run: () => void | Promise<void>;
};

const store = createStore<Record<string, Command>>({});

export function registerCommand(cmd: Command) {
  store.set((prev) => ({ ...prev, [cmd.id]: cmd }));
}

export function unregisterCommand(id: string) {
  store.set((prev) => {
    if (!prev[id]) return prev;
    const { [id]: _removed, ...rest } = prev;
    return rest;
  });
}

export function useCommands(): Command[] {
  const identity = getIdentity();
  return store.use((s) =>
    Object.values(s).filter((c) =>
      hasAll(identity.roleId, c.requiredCapabilityIds ?? []),
    ),
  );
}
