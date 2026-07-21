// React hooks for capability checks.
// Kept in a separate file to avoid a circular import between roles.ts and
// the auth/identity module (roles.ts is imported by auth/provider.ts).

import { useIdentity } from "../auth/identity";
import { hasAll, hasCapability } from "./roles";

export function useHasCapability(capabilityId: string): boolean {
  const identity = useIdentity();
  return hasCapability(identity.roleId, capabilityId);
}

export function useHasAllCapabilities(capabilityIds: string[] = []): boolean {
  const identity = useIdentity();
  return hasAll(identity.roleId, capabilityIds);
}
