// Settings registry. Modules declare their settings sections here.
// The Settings hub renders whatever's registered, in `order` order.

import { createStore } from "../store";
import { hasAll } from "../roles/roles";
import { getIdentity } from "../auth/identity";

export type SettingsSection = {
  id: string;
  moduleId: string;
  label: string;
  route: string; // e.g. "/settings/profile"
  order?: number;
  requiredCapabilityIds?: string[];
};

const store = createStore<Record<string, SettingsSection>>({});

export function registerSettingsSection(section: SettingsSection) {
  store.set((prev) => ({ ...prev, [section.id]: section }));
}

export function useSettingsSections(): SettingsSection[] {
  const identity = getIdentity();
  return store.use((s) =>
    Object.values(s)
      .filter((sec) => hasAll(identity.roleId, sec.requiredCapabilityIds ?? []))
      .sort(
        (a, b) =>
          (a.order ?? 100) - (b.order ?? 100) || a.label.localeCompare(b.label),
      ),
  );
}
