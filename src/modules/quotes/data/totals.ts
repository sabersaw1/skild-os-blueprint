// Pure totals math for the Quotes module — INTEGER CENTS (Phase 13.5).
//
// Quotes stored float dollars until Phase 13.5. Every monetary field is now
// an integer number of cents, computed with `@/core/money` — the same
// implementation Finance and Parts already use — so revenue, parts cost and
// labor cost can be subtracted from one another without mixing units.
// Floating-point dollars exist only at the UI edge (see the form components).

import { assertCents, lineTotalCents } from "@/core/money";
import type { LineItem, LineItemInput, QuoteTotals } from "./schemas";

/** Line total in cents: quantity (possibly fractional) × unit price. */
export function lineTotal(
  item: Pick<LineItem, "quantity" | "unitPriceCents">,
): number {
  return lineTotalCents(item.quantity || 0, item.unitPriceCents || 0);
}

export function computeTotals(
  lineItems: Array<Pick<LineItem, "quantity" | "unitPriceCents">>,
  discountCents = 0,
  taxCents = 0,
): QuoteTotals {
  const subtotal = lineItems.reduce((sum, li) => sum + lineTotal(li), 0);
  const discount = Math.max(0, Math.trunc(discountCents || 0));
  const tax = Math.max(0, Math.trunc(taxCents || 0));
  return {
    subtotalCents: subtotal,
    discountCents: discount,
    taxCents: tax,
    // A discount larger than the subtotal must not invent negative revenue.
    totalCents: Math.max(0, subtotal - discount + tax),
  };
}

export function materializeLineItems(
  items: LineItemInput[],
  makeId: () => string,
): LineItem[] {
  return items.map((li, idx) => {
    assertCents(li.unitPriceCents, `Line item #${idx + 1} unitPriceCents`);
    const quantity = Number(li.quantity) || 0;
    const unitPriceCents = Math.trunc(Number(li.unitPriceCents) || 0);
    return {
      id: makeId(),
      description: li.description.trim(),
      category: li.category,
      quantity,
      unitPriceCents,
      laborHours:
        typeof li.laborHours === "number" && Number.isFinite(li.laborHours)
          ? li.laborHours
          : undefined,
      partReference: li.partReference?.trim() || undefined,
      totalCents: lineTotalCents(quantity, unitPriceCents),
    };
  });
}
