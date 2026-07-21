import { Outlet } from "@tanstack/react-router";
import { createModuleRoute } from "@/core/routes/createModuleRoute";

export const Route = createModuleRoute("/inspections/$inspectionId")({
  moduleId: "inspections",
  component: () => <Outlet />,
});
