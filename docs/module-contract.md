# Module Contract

Every product module in Skild OS is a self-contained folder that registers a `ModuleManifest` at app bootstrap. The shell reads the registry — modules do not import each other, and the shell does not import modules.

## Manifest

```ts
import type { ModuleManifest } from "@/core/modules/registry";

export const manifest: ModuleManifest = {
  id: "customers",
  label: "Customers",
  description: "Customer records and history.",
  capabilities: [
    { id: "customers.read",  description: "View customers.",  ownerModuleId: "customers" },
    { id: "customers.write", description: "Edit customers.",  ownerModuleId: "customers" },
  ],
  navEntries: [
    { id: "customers.nav", label: "Customers", route: "/customers",
      icon: "Users", order: 10, requiredCapabilityIds: ["customers.read"] },
  ],
  commands: [
    { id: "customers.goto", label: "Go to Customers", group: "Navigate",
      requiredCapabilityIds: ["customers.read"],
      run: () => window.location.assign("/customers") },
  ],
  settingsSections: [
    { id: "customers.settings", moduleId: "customers", label: "Customers",
      route: "/settings/customers", requiredCapabilityIds: ["customers.write"] },
  ],
  dashboardWidgets: [
    { id: "customers.recent", moduleId: "customers", title: "Recent customers",
      component: RecentCustomersWidget, span: 1,
      requiredCapabilityIds: ["customers.read"] },
  ],
};
```

Register at bootstrap:

```ts
import { registerModule } from "@/core/modules/registry";
registerModule(manifest);
```

## Rules

- **Never** import from another module. Cross-module needs go through published interfaces in `core/*` or `data/*`.
- Every user-facing surface (nav entry, command, settings section, widget) declares `requiredCapabilityIds`.
- Every state-changing action emits an `ActivityEvent` (see `activity-log.md`).
- Server state (Phase 5+) goes through repository interfaces in `data/`, never directly to a provider client.
- Files uploaded (Phase 4+) go through the Upload Queue (`storage/uploadQueue`), never straight to a provider.

## Folder shape

```
src/modules/<id>/
  manifest.ts       # ModuleManifest export
  routes/           # route files, mirrored under src/routes/ by TSR
  ui/               # module-only components
  logic/            # business rules
  types.ts
  repository.ts     # interface (impl lives in src/data/providers/*)
  README.md         # purpose, capabilities, dependencies
```
