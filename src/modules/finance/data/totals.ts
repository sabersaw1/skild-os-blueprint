// Pure totals math for the Finance module. Exported so tests, forms, and
// widgets can preview totals without going through the repository.
// All values are INTEGER CENTS.

import { lineTotalCents } from "@/core/money";
import type { InvoiceLine, InvoiceLineInput, InvoiceTotals } from "./schemas";

export function computeInvoiceTotals(
  lines: Array<Pick<InvoiceLine, "lineTotal">>,
  discount = 0,
  tax = 0,
): InvoiceTotals {
  const subtotal = lines.reduce(
    (sum, l) => sum + (Number.isSafeInteger(l.lineTotal) ? l.lineTotal : 0),
    0,
  );
  const safeDiscount = Math.max(0, Math.trunc(discount) || 0);
  const safeTax = Math.max(0, Math.trunc(tax) || 0);
  const total = Math.max(0, subtotal - safeDiscount + safeTax);
  return { subtotal, discount: safeDiscount, tax: safeTax, total };
}

export function materializeLines(
  inputs: InvoiceLineInput[],
  makeId: () => string,
): InvoiceLine[] {
  return inputs.map((li) => ({
    id: makeId(),
    description: li.description.trim(),
    category: li.category ?? "other",
    quantity: Number(li.quantity) || 0,
    unitPrice: Math.trunc(Number(li.unitPrice) || 0),
    lineTotal: lineTotalCents(Number(li.quantity) || 0, Math.trunc(Number(li.unitPrice) || 0)),
    partId: li.partId?.trim() || undefined,
    jobId: li.jobId?.trim() || undefined,
    quoteId: li.quoteId?.trim() || undefined,
  }));
}

/** Sequential invoice number from the highest existing number. */
export function nextInvoiceNumber(existing: string[]): string {
  const max = existing.reduce((acc, n) => {
    const m = /^INV-(\d+)$/.exec(n);
    return m ? Math.max(acc, Number(m[1])) : acc;
  }, 0);
  return `INV-${String(max + 1).padStart(4, "0")}`;
}
