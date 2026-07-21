import { Outlet } from "@tanstack/react-router";
import { createModuleRoute } from "@/core/routes/createModuleRoute";

export const Route = createModuleRoute("/quotes")({
  moduleId: "quotes",
  head: () => ({
    meta: [
      { title: "Quotes — Skild OS" },
      {
        name: "description",
        content:
          "Customer quotes: line items, versions, and approval status flow.",
      },
    ],
  }),
  component: () => <Outlet />,
});
