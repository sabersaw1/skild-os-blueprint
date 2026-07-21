import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useHasCapability } from "@/core/roles/hooks";
import { useJobsRepository } from "../hooks";
import type { JobNote } from "../data/schemas";

export function NoteForm({ jobId }: { jobId: string }) {
  const repo = useJobsRepository();
  const canWrite = useHasCapability("jobs.notes.write");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canWrite) return null;

  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setSaving(true);
        try {
          await repo.addNote(jobId, { body });
          setBody("");
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setSaving(false);
        }
      }}
    >
      <Textarea
        value={body}
        rows={2}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a note…"
      />
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={saving || !body.trim()}>
          {saving ? "Adding…" : "Add note"}
        </Button>
      </div>
    </form>
  );
}

export function NoteList({ notes }: { notes: JobNote[] }) {
  if (notes.length === 0) {
    return <p className="text-xs text-muted-foreground">No notes yet.</p>;
  }
  return (
    <ol className="space-y-2">
      {notes
        .slice()
        .reverse()
        .map((n) => (
          <li
            key={n.id}
            className="rounded-md border border-border bg-card p-2 text-sm"
          >
            <p className="whitespace-pre-wrap">{n.body}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(n.createdAt).toLocaleString()} · {n.createdBy}
            </p>
          </li>
        ))}
    </ol>
  );
}
