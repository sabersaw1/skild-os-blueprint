import { Outlet } from "@tanstack/react-router";
import { createModuleRoute } from "@/core/routes/createModuleRoute";

export const Route = createModuleRoute("/jobs/$jobId")({
  moduleId: "jobs",
  component: () => <Outlet />,
});
