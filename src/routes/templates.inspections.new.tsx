import { useNavigate } from "@tanstack/react-router";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { TemplateForm } from "@/modules/inspections/components/TemplateForm";
import { useInspectionsRepository } from "@/modules/inspections/hooks";

export const Route = createModuleRoute("/templates/inspections/new")({
  moduleId: "inspections",
  component: NewTemplate,
});

function NewTemplate() {
  const repo = useInspectionsRepository();
  const navigate = useNavigate();
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">
        New inspection template
      </h1>
      <TemplateForm
        submitLabel="Create"
        onCancel={() => navigate({ to: "/templates/inspections" })}
        onSubmit={async (values) => {
          await repo.createTemplate(values);
          navigate({ to: "/templates/inspections" });
        }}
      />
    </div>
  );
}
