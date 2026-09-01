import { Link, Outlet } from "@tanstack/react-router";
import { createModuleRoute } from "@/core/routes/createModuleRoute";

export const Route = createModuleRoute("/jarvis")({
  moduleId: "assistant",
  head: () => ({
    meta: [
      { title: "Jarvis — Skild OS" },
      {
        name: "description",
        content:
          "Ask Jarvis about the shop. Every answer is grounded in Skild OS records and shows its sources.",
      },
      { property: "og:title", content: "Jarvis — Skild OS" },
      {
        property: "og:description",
        content:
          "A business assistant that reads real records, states what it does not know, and never acts without approval.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JarvisLayout,
});

const tabClass =
  "rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground";

function JarvisLayout() {
  return (
    <div>
      <nav className="mx-auto flex w-full max-w-3xl gap-1 px-4 pt-4">
        <Link
          to="/jarvis"
          activeOptions={{ exact: true }}
          className={tabClass}
          activeProps={{ className: "bg-accent text-accent-foreground" }}
        >
          Ask
        </Link>
        <Link
          to="/jarvis/attention"
          className={tabClass}
          activeProps={{ className: "bg-accent text-accent-foreground" }}
        >
          Needs attention
        </Link>
        <Link
          to="/jarvis/proposals"
          className={tabClass}
          activeProps={{ className: "bg-accent text-accent-foreground" }}
        >
          Proposals
        </Link>
      </nav>
      <Outlet />
    </div>
  );
}
