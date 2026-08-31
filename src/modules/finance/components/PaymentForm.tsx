import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCents, toCents, toDollars } from "@/core/money";
import { useHasCapability } from "@/core/roles/hooks";
import { useFinanceRepository } from "../hooks";
import { PAYMENT_METHODS, type Invoice, type PaymentMethod } from "../data/schemas";

export function PaymentForm({ invoice }: { invoice: Invoice }) {
  const repo = useFinanceRepository();
  const canPay = useHasCapability("finance.payment.write");
  const [amount, setAmount] = useState<number>(invoice.balance);
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canPay) return null;
  if (invoice.status === "draft") {
    return (
      <p className="text-xs text-muted-foreground">
        Issue this invoice before recording payments.
      </p>
    );
  }
  if (invoice.status === "void" || invoice.status === "paid") {
    return (
      <p className="text-xs text-muted-foreground">
        {invoice.status === "paid"
          ? "Paid in full."
          : "This invoice is void — no payments can be recorded."}
      </p>
    );
  }

  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
          await repo.recordPayment(invoice.id, {
            amount,
            method,
            reference: reference || undefined,
          });
          setReference("");
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs">
          Amount ($)
          <Input
            type="number"
            min="0"
            step="0.01"
            value={toDollars(amount)}
            onChange={(e) => setAmount(toCents(e.target.value))}
          />
        </label>
        <label className="text-xs">
          Method
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Reference
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Last 4 / check no."
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Outstanding balance {formatCents(invoice.balance)}
      </p>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" size="sm" disabled={busy || amount <= 0}>
        {busy ? "Recording…" : "Record payment"}
      </Button>
    </form>
  );
}
