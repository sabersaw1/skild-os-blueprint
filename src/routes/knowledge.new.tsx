import { useNavigate } from "@tanstack/react-router";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { DocumentForm } from "@/modules/knowledge/components/DocumentForm";
import { useKnowledgeRepository } from "@/modules/knowledge/hooks";

export const Route = createModuleRoute("/knowledge/new")({
  moduleId: "knowledge",
  component: NewKnowledgeDocument,
});

function NewKnowledgeDocument() {
  const repo = useKnowledgeRepository();
  const navigate = useNavigate();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">
        New knowledge document
      </h1>
      <DocumentForm
        mode="create"
        submitLabel="Create"
        onCancel={() => navigate({ to: "/knowledge" })}
        onSubmit={async (values) => {
          const created = await repo.createDocument({
            type: values.type,
            title: values.title,
            summary: values.summary,
            content: values.content,
            tags: values.tags,
            status: values.status,
            pricingRule: values.pricingRule,
          });
          navigate({
            to: "/knowledge/$knowledgeId",
            params: { knowledgeId: created.id },
          });
        }}
      />
    </div>
  );
}
