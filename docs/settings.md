# Settings

The Settings hub at `/settings` is registry-driven. Modules add sections; the hub renders them in order.

## Registering a section

Usually done through the module manifest, but the underlying API is:

```ts
import { registerSettingsSection } from "@/core/settings/registry";

registerSettingsSection({
  id: "customers.settings",
  moduleId: "customers",
  label: "Customers",
  route: "/settings/customers",
  order: 10,
  requiredCapabilityIds: ["customers.write"],
});
```

## Rules

- Each section owns a route under `/settings/<slug>` and must exist as a TanStack route file (`src/routes/settings.<slug>.tsx`).
- The section respects the current identity's capabilities — if the check fails, the section is hidden.
- Persistence in Phase 1 is browser `localStorage` only. Server-backed settings land with the data layer.

## Phase 1 sections

- `Profile` — display name (local only).
- `Appearance` — theme (system/light/dark), stored in `localStorage`.
- `Modules` — read-only listing of registered modules and capabilities.
