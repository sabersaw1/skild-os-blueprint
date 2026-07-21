// Settings registry. Modules declare their settings sections here.
// The Settings hub renders whatever's registered, in `order` order.
//
// Phase 1.5 adds an optional `schema` field to every settings section.
// The shape is Zod-compatible (`{ parse(input): T }` and/or `{ safeParse }`),
// so modules can plug in Zod later without this file depending on Zod today.
// Any settings persistence layer (in-memory today, IndexedDB / server later)
// MUST validate through `validateSectionValue()` before writing.

import { createStore } from "../store";
import { hasAll } from "../roles/roles";
import { useIdentity } from "../auth/identity";

export interface SettingsSchema<T = unknown> {
  parse(input: unknown): T;
  safeParse?(input: unknown):
    | { success: true; data: T }
    | { success: false; error: unknown };
}

export type SettingsSection<T = unknown> = {
  id: string;
  moduleId: string;
  label: string;
  route: string; // e.g. "/settings/profile"
  order?: number;
  requiredCapabilityIds?: string[];
  /** Optional Zod-compatible schema validating this section's stored value. */
  schema?: SettingsSchema<T>;
  /** Default value returned when nothing is stored. */
  defaultValue?: T;
};

const store = createStore<Record<string, SettingsSection>>({});

export function registerSettingsSection<T>(section: SettingsSection<T>) {
  store.set((prev) => ({
    ...prev,
    [section.id]: section as SettingsSection,
  }));
}

export function getSettingsSection(id: string): SettingsSection | undefined {
  return store.get()[id];
}

/**
 * Validate a value against a registered section's schema.
 * - Missing schema is treated as "no validation required" and returns the value as-is.
 * - Throws through the schema's error on failure. Callers writing settings
 *   MUST call this before persistence.
 */
export function validateSectionValue<T = unknown>(
  sectionId: string,
  value: unknown,
): T {
  const section = getSettingsSection(sectionId);
  if (!section || !section.schema) return value as T;
  return section.schema.parse(value) as T;
}

export function useSettingsSections(): SettingsSection[] {
  const identity = useIdentity();
  return store.use((s) =>
    Object.values(s)
      .filter((sec) => hasAll(identity.roleId, sec.requiredCapabilityIds ?? []))
      .sort(
        (a, b) =>
          (a.order ?? 100) - (b.order ?? 100) || a.label.localeCompare(b.label),
      ),
  );
}
