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

import { createFileRoute } from "@tanstack/react-router";
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

// TanStack's createFileRoute is generic on the path literal; we preserve
// that generic through the wrapper so `Route.useParams()` etc. remain
// typed. The options bag is whatever the inner factory accepts, plus a
// required `moduleId`.
type InnerFactory<TPath extends string> = ReturnType<
  typeof createFileRoute<TPath>
>;
type InnerOptions<TPath extends string> = Parameters<InnerFactory<TPath>>[0];

export type ModuleRouteOptions<TPath extends string> = InnerOptions<TPath> & {
  moduleId: string;
};

export function createModuleRoute<TPath extends string>(path: TPath) {
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
    } as InnerOptions<TPath>);
  };
}
