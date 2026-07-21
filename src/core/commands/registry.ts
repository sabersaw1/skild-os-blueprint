// Command registry for the Command Bar.
// Modules register commands via `registerCommand`. The Command Bar reads
// them through `useCommands`, which filters by:
//   1. The current identity's capabilities (via `requiredCapabilityIds`).
//   2. An optional `visible()` predicate on the command itself (Phase 1.5).
//
// Filtering is exposed as a pure `filterVisibleCommands()` helper so unit
// tests and non-UI callers (e.g. AI suggestions) can reuse it.

import { createStore } from "../store";
import { hasAll } from "../roles/roles";
import { getIdentity, useIdentity } from "../auth/identity";
import type { Identity } from "../auth/provider";

export type Command = {
  id: string;
  label: string;
  group?: string;
  keywords?: string[];
  requiredCapabilityIds?: string[];
  /**
   * Optional runtime visibility predicate.
   * Return false to hide the command even if the identity holds the
   * required capabilities (e.g. hide "Sync now" when the outbox is empty).
   */
  visible?: (ctx: { identity: Identity }) => boolean;
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

/**
 * Pure filter — no React, no store reads. Given a list of commands and an
 * identity, return only the commands the identity may see and run.
 * Exported for tests and for non-UI consumers.
 */
export function filterVisibleCommands(
  commands: Command[],
  identity: Identity,
): Command[] {
  return commands.filter((c) => {
    if (!hasAll(identity.roleId, c.requiredCapabilityIds ?? [])) return false;
    if (c.visible && !c.visible({ identity })) return false;
    return true;
  });
}

/** All registered commands, regardless of capabilities. Admin/debug use only. */
export function listAllCommands(): Command[] {
  return Object.values(store.get());
}

export function useCommands(): Command[] {
  const identity = useIdentity();
  return store.use((s) => filterVisibleCommands(Object.values(s), identity));
}

/** Non-reactive read for imperative call sites (e.g. keyboard handlers). */
export function getVisibleCommands(): Command[] {
  return filterVisibleCommands(Object.values(store.get()), getIdentity());
}
