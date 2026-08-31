import { Outlet } from "@tanstack/react-router";
import { createModuleRoute } from "@/core/routes/createModuleRoute";

export const Route = createModuleRoute("/parts/$partId")({
  moduleId: "parts",
  component: () => <Outlet />,
});
