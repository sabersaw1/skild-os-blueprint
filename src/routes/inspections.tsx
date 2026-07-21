import { Outlet } from "@tanstack/react-router";
import { createModuleRoute } from "@/core/routes/createModuleRoute";

export const Route = createModuleRoute("/inspections")({
  moduleId: "inspections",
  head: () => ({
    meta: [
      { title: "Inspections — Skild OS" },
      {
        name: "description",
        content:
          "Vehicle inspections: templates, findings, condition records, and photo queue.",
      },
    ],
  }),
  component: () => <Outlet />,
});
