import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getStorageDriver } from "@/core/storage/driver";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { emit } from "@/core/activity/emitter";

type Theme = "system" | "light" | "dark";
const KEY = "skildos.appearance.theme";

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const effective = theme === "system" ? (prefersDark ? "dark" : "light") : theme;
  root.classList.toggle("dark", effective === "dark");
}

export const Route = createFileRoute("/settings/appearance")({
  head: () => ({ meta: [{ title: "Appearance — Settings — Skild OS" }] }),
  component: AppearanceSettings,
});

function AppearanceSettings() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    // Phase 15: theme preference goes through the StorageDriver seam, not
    // raw localStorage, so no UI surface bypasses the persistence layer.
    const driver = getStorageDriver();
    const saved = (driver.available() ? driver.read(KEY) : null) as Theme | null;
    const next = saved ?? "system";
    setTheme(next);
    applyTheme(next);
  }, []);

  const onChange = (next: Theme) => {
    setTheme(next);
    const driver = getStorageDriver();
    if (driver.available()) driver.write(KEY, next);

    applyTheme(next);
    emit({
      type: "settings.change",
      moduleId: "settings",
      summary: `Theme set to ${next}`,
      payload: { field: "theme", value: next },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Theme and density. Stored locally in this browser only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid max-w-sm gap-2">
          <Label htmlFor="theme">Theme</Label>
          <Select value={theme} onValueChange={(v) => onChange(v as Theme)}>
            <SelectTrigger id="theme">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
