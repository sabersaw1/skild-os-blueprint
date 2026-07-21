import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useSettingsSections } from "@/core/settings/registry";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Skild OS" },
      { name: "description", content: "Configure Skild OS." },
    ],
  }),
  component: SettingsLayout,
});

function SettingsLayout() {
  const sections = useSettingsSections();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Preferences and module configuration.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_1fr]">
        <nav aria-label="Settings sections" className="space-y-1">
          {sections.map((s) => {
            const active =
              pathname === s.route || pathname.startsWith(s.route + "/");
            return (
              <Link
                key={s.id}
                to={s.route}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                {s.label}
              </Link>
            );
          })}
        </nav>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
