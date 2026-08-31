import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PART_STATUSES, type Part, type Supplier } from "../data/schemas";

export interface PartFormValue {
  name: string;
  partNumber: string;
  description: string;
  manufacturer: string;
  brand: string;
  category: string;
  status: Part["status"];
  preferredSupplierId: string;
}

export function emptyPartForm(): PartFormValue {
  return {
    name: "",
    partNumber: "",
    description: "",
    manufacturer: "",
    brand: "",
    category: "",
    status: "active",
    preferredSupplierId: "",
  };
}

export function partToForm(part: Part): PartFormValue {
  return {
    name: part.name,
    partNumber: part.partNumber ?? "",
    description: part.description ?? "",
    manufacturer: part.manufacturer ?? "",
    brand: part.brand ?? "",
    category: part.category ?? "",
    status: part.status,
    preferredSupplierId: part.preferredSupplierId ?? "",
  };
}

export function PartForm({
  initial,
  suppliers,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: PartFormValue;
  suppliers: Supplier[];
  submitLabel: string;
  onSubmit: (value: PartFormValue) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState<PartFormValue>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof PartFormValue>(k: K, v: PartFormValue[K]) =>
    setValue((prev) => ({ ...prev, [k]: v }));

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
          await onSubmit(value);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not save part.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={value.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Front brake pad set"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="partNumber">Part number</Label>
          <Input
            id="partNumber"
            value={value.partNumber}
            onChange={(e) => set("partNumber", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="brand">Brand</Label>
          <Input
            id="brand"
            value={value.brand}
            onChange={(e) => set("brand", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="manufacturer">Manufacturer</Label>
          <Input
            id="manufacturer"
            value={value.manufacturer}
            onChange={(e) => set("manufacturer", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            value={value.category}
            onChange={(e) => set("category", e.target.value)}
            placeholder="Brakes"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={value.status}
            onValueChange={(v) => set("status", v as Part["status"])}
          >
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PART_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier">Preferred supplier</Label>
          <Select
            value={value.preferredSupplierId || "none"}
            onValueChange={(v) =>
              set("preferredSupplierId", v === "none" ? "" : v)
            }
          >
            <SelectTrigger id="supplier">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={value.description}
            onChange={(e) => set("description", e.target.value)}
            rows={3}
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
