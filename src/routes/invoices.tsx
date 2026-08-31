import { Outlet } from "@tanstack/react-router";
import { createModuleRoute } from "@/core/routes/createModuleRoute";

export const Route = createModuleRoute("/invoices")({
  moduleId: "finance",
  head: () => ({
    meta: [
      { title: "Invoices — Skild OS" },
      {
        name: "description",
        content:
          "Create, issue, and track invoices and payments for mobile mechanic work.",
      },
      { property: "og:title", content: "Invoices — Skild OS" },
      {
        property: "og:description",
        content:
          "Invoicing and payments with immutable issued records and exact cent math.",
      },
    ],
  }),
  component: () => <Outlet />,
});
