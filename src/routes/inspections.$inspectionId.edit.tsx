import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/roles";
import {
  useInspection,
  useInspectionsRepository,
  useInspectionTemplates,
} from "@/modules/inspections/hooks";
import {
  INSPECTION_STATUSES,
  type InspectionStatus,
} from "@/modules/inspections/data/schemas";

export const Route = createModuleRoute("/inspections/$inspectionId/edit")({
  moduleId: "inspections",
  component: EditInspection,
});

function EditInspection() {
  const { inspectionId } = Route.useParams();
  const navigate = useNavigate();
  const repo = useInspectionsRepository();
  const { data: inspection, loading } = useInspection(inspectionId);
  const { data: templates } = useInspectionTemplates();
  const canWrite = useHasCapability("inspections.write");

  const [status, setStatus] = useState<InspectionStatus>("draft");
  const [notes, setNotes] = useState("");
  const [templateId, setTemplateId] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (inspection && !hydrated) {
    setStatus(inspection.status);
    setNotes(inspection.notes);
    setTemplateId(inspection.templateId ?? "");
    setHydrated(true);
  }

  if (loading || !inspection)
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">
        Edit inspection
      </h1>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setSaving(true);
          try {
            await repo.updateInspection(inspectionId, {
              status,
              notes,
              templateId: templateId || undefined,
            });
            navigate({
              to: "/inspections/$inspectionId",
              params: { inspectionId },
            });
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setSaving(false);
          }
        }}
      >
        <div>
          <Label className="mb-2 block">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as InspectionStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INSPECTION_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-2 block">Template</Label>
          <Select
            value={templateId || "none"}
            onValueChange={(v) => setTemplateId(v === "none" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No template</SelectItem>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="e-notes">Notes</Label>
          <Textarea
            id="e-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
          />
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              navigate({
                to: "/inspections/$inspectionId",
                params: { inspectionId },
              })
            }
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
