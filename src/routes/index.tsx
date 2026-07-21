import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard, Sparkles, Keyboard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardWidgets } from "@/core/modules/registry";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Command Center — Skild OS" },
      {
        name: "description",
        content:
          "The Command Center is your default landing surface inside Skild OS.",
      },
    ],
  }),
  component: CommandCenter,
});

function CommandCenter() {
  const widgets = useDashboardWidgets();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:py-10">
      <header className="mb-6 flex items-start gap-3">
        <span className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
          <LayoutDashboard className="h-4 w-4" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Command Center
          </h1>
          <p className="text-sm text-muted-foreground">
            Your operating surface. Widgets registered by modules will appear
            here.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle>Welcome to Skild OS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              This is Phase 1 — the foundation. The shell, navigation, command
              bar, settings, and activity log are in place. No product modules
              (CRM, Vehicles, Inspections, Jobs, Parts, Finance, AI) are wired
              yet — those land in later phases without changing the shell.
            </p>
            <p>
              No external services are connected. Everything you see runs
              locally in your browser.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Keyboard className="h-4 w-4 text-primary" />
            <CardTitle>Quickstart</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Press{" "}
              <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono">
                ⌘K
              </kbd>{" "}
              (or{" "}
              <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono">
                Ctrl K
              </kbd>
              ) anywhere to open the Command Bar.
            </p>
            <p>
              Every state change is recorded to the Activity feed (in-memory in
              Phase 1).
            </p>
          </CardContent>
        </Card>

        {widgets.map((w) => {
          const Widget = w.component;
          return (
            <Card
              key={w.id}
              className={w.span === 2 ? "md:col-span-2" : w.span === 3 ? "md:col-span-3" : undefined}
            >
              <CardHeader>
                <CardTitle>{w.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <Widget />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
