import { Outlet } from "@tanstack/react-router";
import { createModuleRoute } from "@/core/routes/createModuleRoute";

export const Route = createModuleRoute("/knowledge")({
  moduleId: "knowledge",
  head: () => ({
    meta: [
      { title: "Knowledge — Skild OS" },
      {
        name: "description",
        content:
          "Structured business memory: SOPs, repair knowledge, pricing rules.",
      },
    ],
  }),
  component: () => <Outlet />,
});
