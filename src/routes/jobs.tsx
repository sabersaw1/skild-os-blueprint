import { Outlet } from "@tanstack/react-router";
import { createModuleRoute } from "@/core/routes/createModuleRoute";

export const Route = createModuleRoute("/jobs")({
  moduleId: "jobs",
  head: () => ({
    meta: [
      { title: "Jobs — Skild OS" },
      {
        name: "description",
        content:
          "Repair execution: schedule, assign, log labor and notes against approved work.",
      },
    ],
  }),
  component: () => <Outlet />,
});
