import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/customers")({
  head: () => ({
    meta: [
      { title: "Customers — Skild OS" },
      { name: "description", content: "Customer records in Skild OS." },
    ],
  }),
  component: () => <Outlet />,
});
