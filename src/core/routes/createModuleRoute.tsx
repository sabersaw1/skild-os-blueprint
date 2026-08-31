// Route safety helper for module authors.
//
// Wraps TanStack Router's `createFileRoute(...)` factory and:
//   1. Guarantees an `errorComponent` and `notFoundComponent` exist
//      (defaults to shared shell fallbacks). Modules can override.
//   2. Enforces a `moduleId` in options so activity logs / breadcrumbs
//      know the owning module.
//
// The wrapper is generic over the path literal so `Route.useParams()`,
// `Route.useLoaderData()`, `Route.useSearch()`, and friends stay fully
// typed — no manual casts required at call sites.

import { createFileRoute, type FileRoutesByPath } from "@tanstack/react-router";
import type { ComponentType } from "react";

export const DefaultRouteErrorComponent: ComponentType<{ error: Error }> = ({
  error,
}) => (
  <div className="p-6">
    <h2 className="text-lg font-semibold text-foreground">
      Something went wrong
    </h2>
    <p className="mt-2 text-sm text-muted-foreground">
      {error?.message ?? "Unknown error."}
    </p>
  </div>
);

export const DefaultRouteNotFoundComponent: ComponentType = () => (
  <div className="p-6">
    <h2 className="text-lg font-semibold text-foreground">Not found</h2>
    <p className="mt-2 text-sm text-muted-foreground">
      This resource does not exist or you do not have access.
    </p>
  </div>
);

// Constrain to generated route paths so `Route.useParams()` etc. stay typed
// at call sites. `FileRoutesByPath` is produced by the TanStack Router
// Vite plugin from files under src/routes/.
type RoutePath = keyof FileRoutesByPath;
type InnerFactory<TPath extends RoutePath> = ReturnType<
  typeof createFileRoute<TPath>
>;
type InnerOptions<TPath extends RoutePath> = Parameters<InnerFactory<TPath>>[0];

export type ModuleRouteOptions<TPath extends RoutePath> =
  InnerOptions<TPath> & { moduleId: string };

export function createModuleRoute<TPath extends RoutePath>(path: TPath) {
  // NOTE: `inner` is deliberately left un-annotated. Annotating it with
  // `InnerFactory<TPath>` instantiates the factory's own generics with
  // `unknown`, which erases `Route.useParams()` inference at call sites.
  const inner = createFileRoute(path);
  return (options: ModuleRouteOptions<TPath>) => {
    if (!options.moduleId) {
      throw new Error(
        `createModuleRoute("${path}"): moduleId is required.`,
      );
    }
    const { moduleId: _moduleId, ...routeOptions } = options;
    return inner({
      errorComponent: DefaultRouteErrorComponent,
      notFoundComponent: DefaultRouteNotFoundComponent,
      ...routeOptions,
    } as Parameters<typeof inner>[0]);
  };
}
