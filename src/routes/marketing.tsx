import { Link, Outlet } from "@tanstack/react-router";
import { createModuleRoute } from "@/core/routes/createModuleRoute";

export const Route = createModuleRoute("/marketing")({
  moduleId: "marketing",
  head: () => ({
    meta: [
      { title: "Marketing — Skild OS" },
      {
        name: "description",
        content:
          "Marketing opportunities, recommended actions, and measured performance for Skild Auto.",
      },
      { property: "og:title", content: "Marketing — Skild OS" },
      {
        property: "og:description",
        content:
          "Evidence-backed marketing opportunities and the human approvals they require.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MarketingLayout,
});

const tabClass =
  "rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground";

function MarketingLayout() {
  return (
    <div>
      <nav className="mx-auto flex w-full max-w-3xl gap-1 px-4 pt-4">
        <Link
          to="/marketing"
          activeOptions={{ exact: true }}
          className={tabClass}
          activeProps={{ className: "bg-accent text-accent-foreground" }}
        >
          Opportunities
        </Link>
        <Link
          to="/marketing/actions"
          className={tabClass}
          activeProps={{ className: "bg-accent text-accent-foreground" }}
        >
          Actions
        </Link>
        <Link
          to="/marketing/performance"
          className={tabClass}
          activeProps={{ className: "bg-accent text-accent-foreground" }}
        >
          Performance
        </Link>
      </nav>
      <Outlet />
    </div>
  );
}
