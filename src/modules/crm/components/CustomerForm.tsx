import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import type { Customer, CustomerCreateInput } from "../data/repository";

export type CustomerFormValues = CustomerCreateInput;

export function CustomerForm({
  initial,
  submitLabel = "Save",
  onSubmit,
  onCancel,
}: {
  initial?: Partial<Customer>;
  submitLabel?: string;
  onSubmit: (values: CustomerFormValues) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [kind, setKind] = useState<CustomerFormValues["kind"]>(
    initial?.kind ?? "individual",
  );
  const [businessName, setBusinessName] = useState(initial?.businessName ?? "");
  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [primaryEmail, setEmail] = useState(initial?.primaryEmail ?? "");
  const [primaryPhone, setPhone] = useState(initial?.primaryPhone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setSaving(true);
        try {
          await onSubmit({
            kind,
            businessName: businessName || undefined,
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            primaryEmail: primaryEmail || undefined,
            primaryPhone: primaryPhone || undefined,
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setSaving(false);
        }
      }}
    >
      <div>
        <Label className="mb-2 block">Customer type</Label>
        <RadioGroup
          value={kind}
          onValueChange={(v) => setKind(v as CustomerFormValues["kind"])}
          className="flex gap-4"
        >
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="individual" /> Individual
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="business" /> Business
          </label>
        </RadioGroup>
      </div>

      {kind === "business" ? (
        <div>
          <Label htmlFor="businessName">Business name</Label>
          <Input
            id="businessName"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            required
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="lastName">Last name</Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={primaryEmail}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={primaryPhone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
