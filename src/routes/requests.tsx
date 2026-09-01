import { Outlet } from "@tanstack/react-router";
import { createModuleRoute } from "@/core/routes/createModuleRoute";

export const Route = createModuleRoute("/requests")({
  moduleId: "communication",
  head: () => ({
    meta: [
      { title: "Service Requests — Skild OS" },
      {
        name: "description",
        content:
          "Structured customer intake: what was asked for, on which vehicle, and what information is still missing.",
      },
      { property: "og:title", content: "Service Requests — Skild OS" },
      {
        property: "og:description",
        content:
          "Capture and qualify incoming service requests before they become quotes.",
      },
    ],
  }),
  component: () => <Outlet />,
});
