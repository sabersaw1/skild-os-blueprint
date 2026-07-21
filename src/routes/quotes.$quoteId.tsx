import { Outlet } from "@tanstack/react-router";
import { createModuleRoute } from "@/core/routes/createModuleRoute";

export const Route = createModuleRoute("/quotes/$quoteId")({
  moduleId: "quotes",
  component: () => <Outlet />,
});
