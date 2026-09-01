import { Link, Outlet } from "@tanstack/react-router";
import { createModuleRoute } from "@/core/routes/createModuleRoute";

export const Route = createModuleRoute("/automation")({
  moduleId: "automation",
  head: () => ({
    meta: [
      { title: "Automation — Skild OS" },
      {
        name: "description",
        content:
          "Agents, automation rules, runs, and the human approvals every consequential action requires.",
      },
      { property: "og:title", content: "Automation — Skild OS" },
      {
        property: "og:description",
        content:
          "Observe, understand, propose, authorize, execute, verify, record — with a human at the authorize step.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AutomationLayout,
});

const tabClass =
  "rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground";

function AutomationLayout() {
  return (
    <div>
      <nav className="mx-auto flex w-full max-w-3xl gap-1 px-4 pt-4">
        <Link
          to="/automation"
          activeOptions={{ exact: true }}
          className={tabClass}
          activeProps={{ className: "bg-accent text-accent-foreground" }}
        >
          Agents
        </Link>
        <Link
          to="/automation/runs"
          className={tabClass}
          activeProps={{ className: "bg-accent text-accent-foreground" }}
        >
          Runs
        </Link>
        <Link
          to="/automation/approvals"
          className={tabClass}
          activeProps={{ className: "bg-accent text-accent-foreground" }}
        >
          Approvals
        </Link>
      </nav>
      <Outlet />
    </div>
  );
}
