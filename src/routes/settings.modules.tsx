import { createFileRoute } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useModules } from "@/core/modules/registry";
import { useCapabilities } from "@/core/roles/roles";

export const Route = createFileRoute("/settings/modules")({
  head: () => ({ meta: [{ title: "Modules — Settings — Skild OS" }] }),
  component: ModulesSettings,
});

function ModulesSettings() {
  const modules = useModules();
  const capabilities = useCapabilities();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Registered modules</CardTitle>
          <CardDescription>
            Read-only view of every module currently registered with the shell.
            Phase 1 registers the Shell itself; product modules land later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {modules.map((m) => (
              <li key={m.id} className="py-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{m.label}</span>
                  <Badge variant="secondary">{m.id}</Badge>
                </div>
                {m.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {m.description}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {m.navEntries?.length ?? 0} nav ·{" "}
                  {m.commands?.length ?? 0} commands ·{" "}
                  {m.settingsSections?.length ?? 0} settings
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Capabilities</CardTitle>
          <CardDescription>
            The permission surface. Roles bind to capabilities, never to role
            names in code.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {capabilities.map((c) => (
              <li key={c.id} className="py-2">
                <div className="flex items-center gap-2">
                  <code className="text-xs">{c.id}</code>
                  <Badge variant="outline">{c.ownerModuleId}</Badge>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {c.description}
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
