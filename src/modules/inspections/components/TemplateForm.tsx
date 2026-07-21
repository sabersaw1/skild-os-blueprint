import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  InspectionTemplate,
  InspectionTemplateCreateInput,
} from "../data/schemas";

export type TemplateFormValues = InspectionTemplateCreateInput;

export function TemplateForm({
  initial,
  submitLabel = "Create",
  onSubmit,
  onCancel,
}: {
  initial?: Partial<InspectionTemplate>;
  submitLabel?: string;
  onSubmit: (values: TemplateFormValues) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setSaving(true);
        try {
          await onSubmit({
            name,
            description,
            sections: initial?.sections ?? [],
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setSaving(false);
        }
      }}
    >
      <div>
        <Label htmlFor="t-name">Name</Label>
        <Input
          id="t-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={200}
        />
      </div>
      <div>
        <Label htmlFor="t-desc">Description</Label>
        <Textarea
          id="t-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="What this template covers."
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Phase 4: sections are stored but not edited from the UI. A section
        editor lands in a later phase — templates without sections still work
        as an inspection scaffold.
      </p>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
