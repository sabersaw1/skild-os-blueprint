// Roles and capability model for Skild OS.
// In Phase 1 there is a single "Owner" role bound to every registered capability.
// The check surface exists so wiring real users/roles later is a swap-in.

import { createStore } from "../store";
import { useIdentity } from "../auth/identity";

export type Capability = {
  id: string;
  description: string;
  ownerModuleId: string;
};

export type Role = {
  id: string;
  name: string;
  // "*" means all capabilities. Otherwise an explicit list of capability ids.
  capabilityIds: "*" | string[];
};

export const OWNER_ROLE_ID = "owner";

const capabilityStore = createStore<Record<string, Capability>>({});
const roleStore = createStore<Record<string, Role>>({
  [OWNER_ROLE_ID]: {
    id: OWNER_ROLE_ID,
    name: "Owner",
    capabilityIds: "*",
  },
});

export function registerCapability(cap: Capability) {
  capabilityStore.set((prev) =>
    prev[cap.id] ? prev : { ...prev, [cap.id]: cap },
  );
}

export function listCapabilities(): Capability[] {
  return Object.values(capabilityStore.get()).sort((a, b) =>
    a.id.localeCompare(b.id),
  );
}

export function useCapabilities(): Capability[] {
  return capabilityStore.use((s) =>
    Object.values(s).sort((a, b) => a.id.localeCompare(b.id)),
  );
}

export function getRole(roleId: string): Role | undefined {
  return roleStore.get()[roleId];
}

export function hasCapability(roleId: string, capabilityId: string): boolean {
  const role = getRole(roleId);
  if (!role) return false;
  if (role.capabilityIds === "*") return true;
  return role.capabilityIds.includes(capabilityId);
}

// Convenience: check a list. Empty list = no requirement.
export function hasAll(roleId: string, capabilityIds: string[] = []): boolean {
  return capabilityIds.every((c) => hasCapability(roleId, c));
}

// React hooks — resolve against the current identity's role and re-render
// when identity or role changes. Prefer these in UI components over
// hand-rolling capability lookups (Phase 4.1 hardening).

export function useHasCapability(capabilityId: string): boolean {
  const identity = useIdentity();
  return hasCapability(identity.roleId, capabilityId);
}

export function useHasAllCapabilities(capabilityIds: string[] = []): boolean {
  const identity = useIdentity();
  return hasAll(identity.roleId, capabilityIds);
}


// Baseline capabilities the shell itself owns.
registerCapability({
  id: "shell.navigate",
  description: "Navigate between top-level routes.",
  ownerModuleId: "shell",
});
registerCapability({
  id: "commands.run",
  description: "Execute a command from the Command Bar.",
  ownerModuleId: "shell",
});
registerCapability({
  id: "activity.read",
  description: "View the activity feed.",
  ownerModuleId: "activity",
});
registerCapability({
  id: "settings.read",
  description: "Open settings sections.",
  ownerModuleId: "settings",
});
registerCapability({
  id: "settings.write",
  description: "Modify local settings.",
  ownerModuleId: "settings",
});
