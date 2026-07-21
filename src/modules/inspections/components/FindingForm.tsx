import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FINDING_SEVERITIES,
  type FindingSeverity,
  type InspectionFindingCreateInput,
} from "../data/schemas";

export function FindingForm({
  inspectionId,
  onSubmit,
}: {
  inspectionId: string;
  onSubmit: (input: InspectionFindingCreateInput) => Promise<void>;
}) {
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<FindingSeverity>("advisory");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="space-y-3 rounded-md border border-dashed border-border p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setSaving(true);
        try {
          await onSubmit({
            inspectionId,
            category,
            title,
            description,
            severity,
          });
          setCategory("");
          setTitle("");
          setDescription("");
          setSeverity("advisory");
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setSaving(false);
        }
      }}
    >
      <p className="text-xs uppercase text-muted-foreground">Add finding</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="f-category">Category</Label>
          <Input
            id="f-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="brakes, tires, fluids…"
            required
          />
        </div>
        <div>
          <Label htmlFor="f-severity">Severity</Label>
          <Select
            value={severity}
            onValueChange={(v) => setSeverity(v as FindingSeverity)}
          >
            <SelectTrigger id="f-severity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FINDING_SEVERITIES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="f-title">Title</Label>
        <Input
          id="f-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor="f-desc">Description</Label>
        <Textarea
          id="f-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving…" : "Add finding"}
        </Button>
      </div>
    </form>
  );
}
