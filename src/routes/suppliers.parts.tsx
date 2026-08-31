import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import { usePartsRepository, useSuppliers } from "@/modules/parts/hooks";
import {
  SUPPLIER_TYPES,
  type SupplierType,
} from "@/modules/parts/data/schemas";

export const Route = createModuleRoute("/suppliers/parts")({
  moduleId: "parts",
  component: SuppliersPage,
});

function SuppliersPage() {
  const repo = usePartsRepository();
  const { data: suppliers, loading } = useSuppliers();
  const canWrite = useHasCapability("parts.suppliers.write");

  const [name, setName] = useState("");
  const [type, setType] = useState<SupplierType>("parts_store");
  const [website, setWebsite] = useState("");
  const [accountLabel, setAccountLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Parts suppliers
        </h1>
        <p className="text-xs text-muted-foreground">
          Supplier records only — no integrations or credentials are stored.{" "}
          <Link to="/parts" className="text-primary underline">
            Parts catalog
          </Link>
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ul className="mb-6 space-y-2">
          {suppliers.map((s) => (
            <li
              key={s.id}
              className="flex items-start justify-between gap-2 rounded-md border p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{s.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[s.type, s.website, s.accountLabel]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <Badge variant={s.active ? "default" : "secondary"}>
                {s.active ? "active" : "inactive"}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <form
          className="space-y-3 rounded-md border p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setBusy(true);
            try {
              await repo.createSupplier({
                name: name.trim(),
                type,
                website: website.trim() || undefined,
                accountLabel: accountLabel.trim() || undefined,
              });
              setName("");
              setWebsite("");
              setAccountLabel("");
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Could not create supplier.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2 className="text-sm font-semibold">Add supplier</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sup-name">Name</Label>
              <Input
                id="sup-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-type">Type</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as SupplierType)}
              >
                <SelectTrigger id="sup-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPLIER_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-site">Website</Label>
              <Input
                id="sup-site"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-account">Account label</Label>
              <Input
                id="sup-account"
                value={accountLabel}
                onChange={(e) => setAccountLabel(e.target.value)}
                placeholder="Shop account"
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? "Saving…" : "Add supplier"}
          </Button>
        </form>
      )}
    </div>
  );
}
