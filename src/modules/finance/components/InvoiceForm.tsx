import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCents, toCents, toDollars } from "@/core/money";
import { InvoiceLinesEditor } from "./InvoiceLinesEditor";
import { computeInvoiceTotals } from "../data/totals";
import { lineTotalCents } from "@/core/money";
import type { Invoice, InvoiceLineInput } from "../data/schemas";

export interface InvoiceFormValues {
  customerId: string;
  vehicleId?: string;
  jobId?: string;
  quoteId?: string;
  lines: InvoiceLineInput[];
  discount: number;
  tax: number;
  terms?: string;
  notes?: string;
  dueAt?: number;
}

interface Option {
  id: string;
  label: string;
}

export function InvoiceForm({
  initial,
  customers,
  vehicles,
  jobs,
  quotes,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Invoice;
  customers: Option[];
  vehicles: Option[];
  jobs: Option[];
  quotes: Option[];
  submitLabel: string;
  onSubmit: (values: InvoiceFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [customerId, setCustomerId] = useState(initial?.customerId ?? "");
  const [vehicleId, setVehicleId] = useState(initial?.vehicleId ?? "");
  const [jobId, setJobId] = useState(initial?.jobId ?? "");
  const [quoteId, setQuoteId] = useState(initial?.quoteId ?? "");
  const [lines, setLines] = useState<InvoiceLineInput[]>(
    initial?.lines.map((l) => ({
      description: l.description,
      category: l.category,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      partId: l.partId,
      jobId: l.jobId,
      quoteId: l.quoteId,
    })) ?? [],
  );
  const [discount, setDiscount] = useState(initial?.discount ?? 0);
  const [tax, setTax] = useState(initial?.tax ?? 0);
  const [terms, setTerms] = useState(initial?.terms ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [dueAt, setDueAt] = useState(
    initial?.dueAt ? new Date(initial.dueAt).toISOString().slice(0, 10) : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(
    () =>
      computeInvoiceTotals(
        lines.map((l) => ({
          lineTotal: lineTotalCents(l.quantity, l.unitPrice),
        })),
        discount,
        tax,
      ),
    [lines, discount, tax],
  );

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
          await onSubmit({
            customerId,
            vehicleId: vehicleId || undefined,
            jobId: jobId || undefined,
            quoteId: quoteId || undefined,
            lines,
            discount,
            tax,
            terms: terms || undefined,
            notes: notes || undefined,
            dueAt: dueAt ? new Date(dueAt).getTime() : undefined,
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs">
          Customer *
          <select
            required
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            disabled={Boolean(initial)}
          >
            <option value="">Select a customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Vehicle
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
          >
            <option value="">None</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Job
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
          >
            <option value="">None</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Quote
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={quoteId}
            onChange={(e) => setQuoteId(e.target.value)}
          >
            <option value="">None</option>
            {quotes.map((q) => (
              <option key={q.id} value={q.id}>
                {q.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Lines</h2>
        <InvoiceLinesEditor value={lines} onChange={setLines} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs">
          Discount ($)
          <Input
            type="number"
            min="0"
            step="0.01"
            value={toDollars(discount)}
            onChange={(e) => setDiscount(toCents(e.target.value))}
          />
        </label>
        <label className="text-xs">
          Tax ($)
          <Input
            type="number"
            min="0"
            step="0.01"
            value={toDollars(tax)}
            onChange={(e) => setTax(toCents(e.target.value))}
          />
        </label>
        <label className="text-xs">
          Due date
          <Input
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </label>
      </div>

      <dl className="ml-auto grid max-w-xs grid-cols-2 gap-1 text-sm">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd className="text-right">{formatCents(totals.subtotal)}</dd>
        <dt className="text-muted-foreground">Discount</dt>
        <dd className="text-right">−{formatCents(totals.discount)}</dd>
        <dt className="text-muted-foreground">Tax</dt>
        <dd className="text-right">{formatCents(totals.tax)}</dd>
        <dt className="font-semibold">Total</dt>
        <dd className="text-right font-semibold">{formatCents(totals.total)}</dd>
      </dl>

      <label className="block text-xs">
        Terms
        <Input
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          placeholder="Net 14"
        />
      </label>
      <label className="block text-xs">
        Notes
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </label>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !customerId}>
          {busy ? "Saving…" : submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
