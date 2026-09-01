import { Outlet } from "@tanstack/react-router";
import { createModuleRoute } from "@/core/routes/createModuleRoute";

export const Route = createModuleRoute("/leads")({
  moduleId: "marketing",
  head: () => ({
    meta: [
      { title: "Leads — Skild OS" },
      {
        name: "description",
        content:
          "Every inquiry Skild Auto receives, where it came from, what stage it is in, and what it turned into.",
      },
      { property: "og:title", content: "Leads — Skild OS" },
      {
        property: "og:description",
        content:
          "Track leads from first touch through quote, job, and revenue — nothing gets missed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Outlet />,
});
