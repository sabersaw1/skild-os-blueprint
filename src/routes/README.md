# Routes

TanStack Router file-based routing. The plugin regenerates `src/routeTree.gen.ts` on every build/dev — never edit it by hand.

## Naming rules (recap)

- Dots in filenames become slashes in the route path.
- `index.tsx` is the leaf.
- `$name` is a dynamic segment; `$.tsx` is a splat.
- Underscore-prefixed segments are pathless layouts.

## Phase 1 routes

| File                            | URL                    | Purpose                          |
| ------------------------------- | ---------------------- | -------------------------------- |
| `__root.tsx`                    | (layout)               | Global head + AppShell wrapper.  |
| `index.tsx`                     | `/`                    | Command Center.                  |
| `activity.tsx`                  | `/activity`            | Activity feed.                   |
| `settings.tsx`                  | `/settings` (layout)   | Settings hub with `<Outlet />`.  |
| `settings.index.tsx`            | `/settings`            | Redirects to `/settings/profile`.|
| `settings.profile.tsx`          | `/settings/profile`    | Local profile placeholder.       |
| `settings.appearance.tsx`       | `/settings/appearance` | Theme / density.                 |
| `settings.modules.tsx`          | `/settings/modules`    | Registered modules + capabilities.|

Every route file declares a `head()` with a route-specific title.
