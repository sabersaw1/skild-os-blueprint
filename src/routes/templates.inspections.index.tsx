import { Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useInspectionTemplates } from "@/modules/inspections/hooks";

export const Route = createModuleRoute("/templates/inspections/")({
  moduleId: "inspections",
  head: () => ({
    meta: [
      { title: "Inspection Templates — Skild OS" },
      {
        name: "description",
        content: "Reusable inspection checklists.",
      },
    ],
  }),
  component: TemplatesIndex,
});

function TemplatesIndex() {
  const navigate = useNavigate();
  const { data, loading } = useInspectionTemplates();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Inspection templates
          </h1>
          <p className="text-xs text-muted-foreground">
            {data.length} template{data.length === 1 ? "" : "s"} ·{" "}
            <Link to="/inspections" className="text-primary underline">
              Inspections
            </Link>
          </p>
        </div>
        <Button onClick={() => navigate({ to: "/templates/inspections/new" })}>
          <Plus className="mr-1 h-4 w-4" /> New template
        </Button>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No templates yet.{" "}
            <Link
              to="/templates/inspections/new"
              className="text-primary underline"
            >
              Create one
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {data.map((t) => (
            <li
              key={t.id}
              className="rounded-md border border-border bg-card px-3 py-2"
            >
              <p className="text-sm font-medium">{t.name}</p>
              <p className="text-xs text-muted-foreground">
                {t.description || "—"} · {t.sections.length} section
                {t.sections.length === 1 ? "" : "s"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
