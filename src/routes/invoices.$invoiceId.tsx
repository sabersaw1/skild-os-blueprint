import { Outlet } from "@tanstack/react-router";
import { createModuleRoute } from "@/core/routes/createModuleRoute";

export const Route = createModuleRoute("/invoices/$invoiceId")({
  moduleId: "finance",
  component: () => <Outlet />,
});
