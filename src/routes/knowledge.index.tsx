import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useKnowledgeDocuments } from "@/modules/knowledge/hooks";
import { DocumentListItem } from "@/modules/knowledge/components/DocumentListItem";
import {
  KNOWLEDGE_DOCUMENT_TYPES,
  type KnowledgeDocumentType,
} from "@/modules/knowledge/data/schemas";

export const Route = createModuleRoute("/knowledge/")({
  moduleId: "knowledge",
  component: KnowledgeIndex,
});

function KnowledgeIndex() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<KnowledgeDocumentType | "all">("all");

  const query = useMemo(
    () => ({
      search: search || undefined,
      type: type === "all" ? undefined : type,
    }),
    [search, type],
  );
  const { data, loading } = useKnowledgeDocuments(query);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Knowledge</h1>
          <p className="text-xs text-muted-foreground">
            {data.length} document{data.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button onClick={() => navigate({ to: "/knowledge/new" })}>
          <Plus className="mr-1 h-4 w-4" /> New document
        </Button>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search title, summary, tags…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {KNOWLEDGE_DOCUMENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No documents yet.{" "}
            <Link to="/knowledge/new" className="text-primary underline">
              Create your first one
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((d) => (
            <DocumentListItem key={d.id} document={d} />
          ))}
        </div>
      )}
    </div>
  );
}
