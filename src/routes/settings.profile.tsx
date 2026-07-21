import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useIdentity, updateIdentity } from "@/core/auth/identity";
import { emit } from "@/core/activity/emitter";
import { toast } from "sonner";

export const Route = createFileRoute("/settings/profile")({
  head: () => ({ meta: [{ title: "Profile — Settings — Skild OS" }] }),
  component: ProfileSettings,
});

function ProfileSettings() {
  const identity = useIdentity();
  const [name, setName] = useState(identity.displayName);

  const save = () => {
    const trimmed = name.trim() || "Operator";
    updateIdentity({ displayName: trimmed });
    emit({
      type: "settings.change",
      moduleId: "settings",
      summary: `Updated display name to "${trimmed}"`,
      payload: { field: "displayName" },
    });
    toast.success("Profile updated");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          Local placeholder. Real user accounts arrive with authentication in a
          later phase.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="grid gap-2">
          <Label>Role</Label>
          <p className="text-sm text-muted-foreground">
            Owner (Phase 1 — single role holds all capabilities).
          </p>
        </div>
        <div>
          <Button onClick={save}>Save</Button>
        </div>
      </CardContent>
    </Card>
  );
}
