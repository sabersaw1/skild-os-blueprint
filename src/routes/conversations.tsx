import { Outlet } from "@tanstack/react-router";
import { createModuleRoute } from "@/core/routes/createModuleRoute";

export const Route = createModuleRoute("/conversations")({
  moduleId: "communication",
  head: () => ({
    meta: [
      { title: "Conversations — Skild OS" },
      {
        name: "description",
        content:
          "Customer conversation threads across every channel, linked to vehicles, quotes, jobs, and invoices.",
      },
      { property: "og:title", content: "Conversations — Skild OS" },
      {
        property: "og:description",
        content:
          "Provider-agnostic customer communication threads with human-approved outbound messaging.",
      },
    ],
  }),
  component: () => <Outlet />,
});
