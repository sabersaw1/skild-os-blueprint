import { Link, useRouterState } from "@tanstack/react-router";
import * as Icons from "lucide-react";
import { useNavEntries } from "@/core/modules/registry";
import { cn } from "@/lib/utils";

type LucideIcon = typeof Icons.LayoutDashboard;

function resolveIcon(name?: string): LucideIcon {
  if (!name) return Icons.Circle;
  const map = Icons as unknown as Record<string, LucideIcon>;
  return map[name] ?? Icons.Circle;
}

export function MobileNav() {
  const entries = useNavEntries();
  const currentPath = useRouterState({
    select: (r) => r.location.pathname,
  });

  const isActive = (route: string) =>
    route === "/"
      ? currentPath === "/"
      : currentPath === route || currentPath.startsWith(route + "/");

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background md:hidden"
      aria-label="Primary"
    >
      <ul className="grid grid-cols-3">
        {entries.map((e) => {
          const Icon = resolveIcon(e.icon);
          const active = isActive(e.route);
          return (
            <li key={e.id}>
              <Link
                to={e.route}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2 text-xs",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{e.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
