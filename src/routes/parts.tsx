import { Outlet } from "@tanstack/react-router";
import { createModuleRoute } from "@/core/routes/createModuleRoute";

export const Route = createModuleRoute("/parts")({
  moduleId: "parts",
  head: () => ({
    meta: [
      { title: "Parts — Skild OS" },
      {
        name: "description",
        content:
          "Parts catalog, suppliers, purchases, and parts used on vehicles and jobs.",
      },
      { property: "og:title", content: "Parts — Skild OS" },
      {
        property: "og:description",
        content: "Parts catalog and purchasing for mobile mechanic operations.",
      },
    ],
  }),
  component: () => <Outlet />,
});
