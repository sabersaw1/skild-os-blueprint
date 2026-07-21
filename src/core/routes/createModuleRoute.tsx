// Route safety helper for module authors.
//
// Wraps TanStack Router's `createFileRoute(...)` factory and:
//   1. Guarantees an `errorComponent` and `notFoundComponent` exist (defaults
//      to shared shell fallbacks). Modules can override.
//   2. Enforces a `moduleId` in options so activity logs / breadcrumbs know
//      the owning module.
//
// Usage:
//   export const Route = createModuleRoute("/customers")({
//     moduleId: "crm",
//     component: CustomersPage,
//     // errorComponent / notFoundComponent are auto-provided.
//   });
//
// This helper is intentionally thin — it does NOT hide any TanStack API,
// only defaults required boundaries.

import { createFileRoute } from "@tanstack/react-router";
import type { ComponentType } from "react";

type BaseOptions = Parameters<ReturnType<typeof createFileRoute>>[0];

export type ModuleRouteOptions = BaseOptions & {
  moduleId: string;
};

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

export function createModuleRoute(path: Parameters<typeof createFileRoute>[0]) {
  const inner = createFileRoute(path);
  return (options: ModuleRouteOptions) => {
    if (!options.moduleId) {
      throw new Error(
        `createModuleRoute("${String(path)}"): moduleId is required.`,
      );
    }
    // Strip moduleId before forwarding to TanStack (it's shell metadata, not
    // a router option).
    const { moduleId: _moduleId, ...routeOptions } = options;
    return inner({
      errorComponent: DefaultRouteErrorComponent,
      notFoundComponent: DefaultRouteNotFoundComponent,
      ...routeOptions,
    } as BaseOptions);
  };
}
