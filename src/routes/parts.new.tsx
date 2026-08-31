import { useNavigate } from "@tanstack/react-router";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import { usePartsRepository, useSuppliers } from "@/modules/parts/hooks";
import {
  PartForm,
  emptyPartForm,
} from "@/modules/parts/components/PartForm";

export const Route = createModuleRoute("/parts/new")({
  moduleId: "parts",
  component: NewPart,
});

function NewPart() {
  const navigate = useNavigate();
  const repo = usePartsRepository();
  const { data: suppliers } = useSuppliers();
  const canWrite = useHasCapability("parts.write");

  if (!canWrite) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <p className="text-sm text-muted-foreground">
          You do not have permission to create parts.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">New part</h1>
      <PartForm
        initial={emptyPartForm()}
        suppliers={suppliers}
        submitLabel="Create part"
        onCancel={() => navigate({ to: "/parts" })}
        onSubmit={async (v) => {
          const part = await repo.createPart({
            name: v.name.trim(),
            partNumber: v.partNumber.trim() || undefined,
            description: v.description.trim() || undefined,
            manufacturer: v.manufacturer.trim() || undefined,
            brand: v.brand.trim() || undefined,
            category: v.category.trim() || undefined,
            status: v.status,
            preferredSupplierId: v.preferredSupplierId || undefined,
          });
          navigate({ to: "/parts/$partId", params: { partId: part.id } });
        }}
      />
    </div>
  );
}
