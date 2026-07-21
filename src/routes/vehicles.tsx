import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/vehicles")({
  head: () => ({
    meta: [
      { title: "Vehicles — Skild OS" },
      { name: "description", content: "Vehicle records in Skild OS." },
    ],
  }),
  component: () => <Outlet />,
});
