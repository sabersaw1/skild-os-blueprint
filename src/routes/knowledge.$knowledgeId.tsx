import { Outlet } from "@tanstack/react-router";
import { createModuleRoute } from "@/core/routes/createModuleRoute";

export const Route = createModuleRoute("/knowledge/$knowledgeId")({
  moduleId: "knowledge",
  component: () => <Outlet />,
});
