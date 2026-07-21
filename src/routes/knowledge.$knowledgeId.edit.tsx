import { useNavigate } from "@tanstack/react-router";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { DocumentForm } from "@/modules/knowledge/components/DocumentForm";
import {
  useKnowledgeDocument,
  useKnowledgeRepository,
} from "@/modules/knowledge/hooks";

export const Route = createModuleRoute("/knowledge/$knowledgeId/edit")({
  moduleId: "knowledge",
  component: EditKnowledgeDocument,
});

function EditKnowledgeDocument() {
  const { knowledgeId } = Route.useParams();
  const { data: doc, loading } = useKnowledgeDocument(knowledgeId);
  const repo = useKnowledgeRepository();
  const navigate = useNavigate();

  if (loading)
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!doc)
    return (
      <p className="p-6 text-sm text-muted-foreground">Document not found.</p>
    );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">
        Edit knowledge document
      </h1>
      <DocumentForm
        initial={doc}
        mode="edit"
        submitLabel="Save changes (new version)"
        onCancel={() =>
          navigate({
            to: "/knowledge/$knowledgeId",
            params: { knowledgeId },
          })
        }
        onSubmit={async (values) => {
          if (!values.changeReason?.trim()) {
            throw new Error("Change reason is required.");
          }
          await repo.updateDocument(
            knowledgeId,
            {
              title: values.title,
              summary: values.summary,
              content: values.content,
              tags: values.tags,
              status: values.status,
              pricingRule: values.pricingRule,
            },
            values.changeReason,
          );
          navigate({
            to: "/knowledge/$knowledgeId",
            params: { knowledgeId },
          });
        }}
      />
    </div>
  );
}
