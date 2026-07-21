// Pure totals math for the Quotes module. Exported so tests and UI can
// preview totals without going through the repository.

import type { LineItem, LineItemInput, QuoteTotals } from "./schemas";

/** Round to 2 decimal places using banker-safe half-up. */
export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function lineTotal(item: Pick<LineItem, "quantity" | "unitPrice">): number {
  return round2((item.quantity || 0) * (item.unitPrice || 0));
}

export function computeTotals(
  lineItems: Array<Pick<LineItem, "quantity" | "unitPrice">>,
  discount = 0,
  tax = 0,
): QuoteTotals {
  const subtotal = round2(
    lineItems.reduce((sum, li) => sum + lineTotal(li), 0),
  );
  const safeDiscount = round2(Math.max(0, discount));
  const safeTax = round2(Math.max(0, tax));
  const total = round2(subtotal - safeDiscount + safeTax);
  return { subtotal, discount: safeDiscount, tax: safeTax, total };
}

export function materializeLineItems(
  items: LineItemInput[],
  makeId: () => string,
): LineItem[] {
  return items.map((li) => ({
    id: makeId(),
    description: li.description.trim(),
    category: li.category,
    quantity: Number(li.quantity) || 0,
    unitPrice: Number(li.unitPrice) || 0,
    laborHours:
      typeof li.laborHours === "number" && Number.isFinite(li.laborHours)
        ? li.laborHours
        : undefined,
    partReference: li.partReference?.trim() || undefined,
    total: lineTotal({ quantity: li.quantity, unitPrice: li.unitPrice }),
  }));
}
