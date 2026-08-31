import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import {
  usePart,
  usePartsRepository,
  useSuppliers,
} from "@/modules/parts/hooks";
import { PartForm, partToForm } from "@/modules/parts/components/PartForm";

export const Route = createModuleRoute("/parts/$partId/edit")({
  moduleId: "parts",
  component: EditPart,
});

function EditPart() {
  const { partId } = Route.useParams();
  const navigate = useNavigate();
  const repo = usePartsRepository();
  const { data: part, loading } = usePart(partId);
  const { data: suppliers } = useSuppliers();
  const canWrite = useHasCapability("parts.write");

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  }
  if (!part) {
    return <p className="p-6 text-sm text-muted-foreground">Part not found.</p>;
  }
  if (!canWrite) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        You do not have permission to edit parts.
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Edit part</h1>
      <PartForm
        initial={partToForm(part)}
        suppliers={suppliers}
        submitLabel="Save changes"
        onCancel={() =>
          navigate({ to: "/parts/$partId", params: { partId } })
        }
        onSubmit={async (v) => {
          await repo.updatePart(partId, {
            name: v.name.trim(),
            partNumber: v.partNumber.trim() || undefined,
            description: v.description.trim() || undefined,
            manufacturer: v.manufacturer.trim() || undefined,
            brand: v.brand.trim() || undefined,
            category: v.category.trim() || undefined,
            status: v.status,
            preferredSupplierId: v.preferredSupplierId || null,
          });
          navigate({ to: "/parts/$partId", params: { partId } });
        }}
      />
      <div className="mt-6">
        <Button
          variant="outline"
          onClick={async () => {
            await repo.archivePart(partId);
            navigate({ to: "/parts" });
          }}
        >
          Archive part
        </Button>
      </div>
    </div>
  );
}
