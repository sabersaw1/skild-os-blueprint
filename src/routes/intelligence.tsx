import { Link, Outlet } from "@tanstack/react-router";
import { createModuleRoute } from "@/core/routes/createModuleRoute";

export const Route = createModuleRoute("/intelligence")({
  moduleId: "intelligence",
  component: IntelligenceLayout,
});

const TABS = [
  { to: "/intelligence", label: "Overview", exact: true },
  { to: "/intelligence/performance", label: "Performance", exact: false },
  { to: "/intelligence/findings", label: "Findings", exact: false },
  { to: "/intelligence/metrics", label: "Metrics", exact: false },
] as const;

function IntelligenceLayout() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <nav className="mb-6 flex flex-wrap gap-3 border-b pb-3 text-sm">
        {TABS.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            activeOptions={{ exact: t.exact }}
            activeProps={{ className: "font-semibold text-foreground" }}
            className="text-muted-foreground hover:text-foreground"
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
