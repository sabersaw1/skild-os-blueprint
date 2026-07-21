// Module registry. Modules declare a manifest describing routes, nav entries,
// commands, settings sections, dashboard widgets, and required capabilities.
// The shell reads registered manifests to build navigation and dashboards.
//
// In Phase 1 no product modules exist — only the shell itself registers a
// manifest so the Modules settings page has something to show and the
// contract is exercised end-to-end.

import type { ComponentType } from "react";
import { createStore } from "../store";
import { registerCommand, type Command } from "../commands/registry";
import {
  registerSettingsSection,
  type SettingsSection,
} from "../settings/registry";
import { registerCapability, type Capability } from "../roles/roles";

export type NavEntry = {
  id: string;
  label: string;
  route: string;
  icon?: string; // lucide icon name; resolved in the sidebar
  order?: number;
  requiredCapabilityIds?: string[];
};

export type DashboardWidget = {
  id: string;
  moduleId: string;
  title: string;
  component: ComponentType;
  span?: 1 | 2 | 3; // grid span
  order?: number;
  requiredCapabilityIds?: string[];
};

export type ModuleManifest = {
  id: string;
  label: string;
  description?: string;
  capabilities?: Capability[];
  navEntries?: NavEntry[];
  commands?: Omit<Command, "id"> &
    { id: string } extends never
    ? never
    : Command[];
  settingsSections?: SettingsSection[];
  dashboardWidgets?: DashboardWidget[];
};

const modules = createStore<Record<string, ModuleManifest>>({});
const widgets = createStore<Record<string, DashboardWidget>>({});
const navEntries = createStore<Record<string, NavEntry>>({});

export function registerModule(manifest: ModuleManifest) {
  modules.set((prev) => ({ ...prev, [manifest.id]: manifest }));

  manifest.capabilities?.forEach(registerCapability);
  manifest.commands?.forEach(registerCommand);
  manifest.settingsSections?.forEach(registerSettingsSection);

  manifest.dashboardWidgets?.forEach((w) => {
    widgets.set((prev) => ({ ...prev, [w.id]: w }));
  });
  manifest.navEntries?.forEach((n) => {
    navEntries.set((prev) => ({ ...prev, [n.id]: n }));
  });
}

export function useModules(): ModuleManifest[] {
  return modules.use((s) =>
    Object.values(s).sort((a, b) => a.label.localeCompare(b.label)),
  );
}

export function useNavEntries(): NavEntry[] {
  return navEntries.use((s) =>
    Object.values(s).sort(
      (a, b) =>
        (a.order ?? 100) - (b.order ?? 100) || a.label.localeCompare(b.label),
    ),
  );
}

export function useDashboardWidgets(): DashboardWidget[] {
  return widgets.use((s) =>
    Object.values(s).sort(
      (a, b) =>
        (a.order ?? 100) - (b.order ?? 100) || a.title.localeCompare(b.title),
    ),
  );
}
