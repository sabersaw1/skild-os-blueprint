import { Link, useNavigate } from "@tanstack/react-router";
import { Archive, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import {
  useKnowledgeDocument,
  useKnowledgeLinks,
  useKnowledgeRepository,
  useKnowledgeVersions,
} from "@/modules/knowledge/hooks";
import { VersionHistoryList } from "@/modules/knowledge/components/VersionHistoryList";
import { LinkList } from "@/modules/knowledge/components/LinkList";

export const Route = createModuleRoute("/knowledge/$knowledgeId/")({
  moduleId: "knowledge",
  component: KnowledgeDetail,
});

function KnowledgeDetail() {
  const { knowledgeId } = Route.useParams();
  const navigate = useNavigate();
  const repo = useKnowledgeRepository();
  const { data: doc, loading } = useKnowledgeDocument(knowledgeId);
  const { data: versions } = useKnowledgeVersions(knowledgeId);
  const { data: links } = useKnowledgeLinks(knowledgeId);

  if (loading)
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!doc)
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Document not found.</p>
        <Link to="/knowledge" className="text-primary underline">
          Back to knowledge
        </Link>
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{doc.title}</h1>
          <p className="text-sm text-muted-foreground">
            {doc.type.replace("_", " ")} · v{doc.versionNumber} · {doc.status}
          </p>
          {doc.summary && (
            <p className="mt-1 text-sm text-muted-foreground">{doc.summary}</p>
          )}
          {doc.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {doc.tags.map((t) => (
                <span
                  key={t}
                  className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              navigate({
                to: "/knowledge/$knowledgeId/edit",
                params: { knowledgeId },
              })
            }
          >
            <Pencil className="mr-1 h-4 w-4" /> Edit
          </Button>
          {doc.status !== "archived" && (
            <Button
              variant="outline"
              onClick={async () => {
                if (confirm("Archive this document?")) {
                  await repo.archiveDocument(knowledgeId);
                }
              }}
            >
              <Archive className="mr-1 h-4 w-4" /> Archive
            </Button>
          )}
        </div>
      </header>

      <section className="mb-8">
        <h2 className="mb-2 text-base font-medium">Content</h2>
        <pre className="whitespace-pre-wrap rounded-md border border-border bg-card p-4 text-sm">
          {doc.content}
        </pre>
      </section>

      {doc.pricingRule && (
        <section className="mb-8">
          <h2 className="mb-2 text-base font-medium">Pricing rule</h2>
          <dl className="grid grid-cols-2 gap-2 rounded-md border border-border bg-card p-4 text-sm">
            <dt className="text-muted-foreground">Name</dt>
            <dd>{doc.pricingRule.name}</dd>
            <dt className="text-muted-foreground">Category</dt>
            <dd>{doc.pricingRule.category}</dd>
            <dt className="text-muted-foreground">Base labor</dt>
            <dd>{doc.pricingRule.baseLabor}</dd>
            <dt className="text-muted-foreground">Markup %</dt>
            <dd>{doc.pricingRule.markupPercent}</dd>
            <dt className="text-muted-foreground">Minimum margin</dt>
            <dd>{doc.pricingRule.minimumMargin}</dd>
            <dt className="text-muted-foreground">Approval required</dt>
            <dd>{doc.pricingRule.approvalRequired ? "Yes" : "No"}</dd>
          </dl>
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-2 text-base font-medium">
          Version history ({versions.length})
        </h2>
        <VersionHistoryList versions={versions} />
      </section>

      <section>
        <h2 className="mb-2 text-base font-medium">Linked items ({links.length})</h2>
        <LinkList links={links} />
      </section>
    </div>
  );
}
