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
  KNOWLEDGE_DOCUMENT_TYPES,
  KNOWLEDGE_STATUSES,
  type KnowledgeDocument,
  type KnowledgeDocumentCreateInput,
  type KnowledgeDocumentType,
  type KnowledgeStatus,
  type PricingRulePayload,
} from "../data/schemas";

export type DocumentFormValues = KnowledgeDocumentCreateInput & {
  changeReason?: string;
};

export function DocumentForm({
  initial,
  mode,
  submitLabel = "Save",
  onSubmit,
  onCancel,
}: {
  initial?: Partial<KnowledgeDocument>;
  /** "create" hides changeReason; "edit" requires it. */
  mode: "create" | "edit";
  submitLabel?: string;
  onSubmit: (values: DocumentFormValues) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [type, setType] = useState<KnowledgeDocumentType>(
    initial?.type ?? "sop",
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [tagsInput, setTagsInput] = useState((initial?.tags ?? []).join(", "));
  const [status, setStatus] = useState<KnowledgeStatus>(
    initial?.status ?? "draft",
  );
  const [changeReason, setChangeReason] = useState("");

  const [pr, setPr] = useState<PricingRulePayload>(
    initial?.pricingRule ?? {
      name: "",
      category: "",
      baseLabor: 0,
      markupPercent: 0,
      minimumMargin: 0,
      approvalRequired: false,
    },
  );

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
          const tags = tagsInput
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
          await onSubmit({
            type,
            title,
            summary,
            content,
            tags,
            status,
            pricingRule: type === "pricing_rule" ? pr : undefined,
            changeReason: mode === "edit" ? changeReason : undefined,
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label className="mb-2 block">Type</Label>
          <Select
            value={type}
            onValueChange={(v) => setType(v as KnowledgeDocumentType)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KNOWLEDGE_DOCUMENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-2 block">Status</Label>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as KnowledgeStatus)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KNOWLEDGE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="k-title">Title</Label>
        <Input
          id="k-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
        />
      </div>

      <div>
        <Label htmlFor="k-summary">Summary</Label>
        <Input
          id="k-summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          maxLength={300}
          placeholder="One line description"
        />
      </div>

      <div>
        <Label htmlFor="k-content">Content</Label>
        <Textarea
          id="k-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          required
        />
      </div>

      <div>
        <Label htmlFor="k-tags">Tags (comma-separated)</Label>
        <Input
          id="k-tags"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="brakes, honda, warranty"
        />
      </div>

      {type === "pricing_rule" && (
        <fieldset className="space-y-3 rounded-md border border-border p-3">
          <legend className="px-1 text-xs uppercase text-muted-foreground">
            Pricing rule
          </legend>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="pr-name">Name</Label>
              <Input
                id="pr-name"
                value={pr.name}
                onChange={(e) => setPr({ ...pr, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="pr-cat">Category</Label>
              <Input
                id="pr-cat"
                value={pr.category}
                onChange={(e) => setPr({ ...pr, category: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="pr-labor">Base labor</Label>
              <Input
                id="pr-labor"
                type="number"
                min={0}
                step="0.01"
                value={pr.baseLabor}
                onChange={(e) =>
                  setPr({ ...pr, baseLabor: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <Label htmlFor="pr-markup">Markup %</Label>
              <Input
                id="pr-markup"
                type="number"
                min={0}
                step="0.01"
                value={pr.markupPercent}
                onChange={(e) =>
                  setPr({ ...pr, markupPercent: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <Label htmlFor="pr-min">Minimum margin</Label>
              <Input
                id="pr-min"
                type="number"
                min={0}
                step="0.01"
                value={pr.minimumMargin}
                onChange={(e) =>
                  setPr({ ...pr, minimumMargin: Number(e.target.value) })
                }
              />
            </div>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input
                type="checkbox"
                checked={pr.approvalRequired}
                onChange={(e) =>
                  setPr({ ...pr, approvalRequired: e.target.checked })
                }
              />
              Approval required
            </label>
          </div>
        </fieldset>
      )}

      {mode === "edit" && (
        <div>
          <Label htmlFor="k-reason">Change reason</Label>
          <Input
            id="k-reason"
            value={changeReason}
            onChange={(e) => setChangeReason(e.target.value)}
            required
            placeholder="Why this edit? Stored on the new version."
          />
        </div>
      )}

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
