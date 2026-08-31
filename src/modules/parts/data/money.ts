// Deterministic money helpers for the Parts module.
//
// CONVENTION: every persisted monetary value in Parts is an INTEGER NUMBER
// OF CENTS (USD). No floating-point dollars are ever written to storage.
// Dollars only exist at the UI edge, converted via `toCents` / `formatCents`.
//
// Phase 8 promoted the shared primitives to `@/core/money` so Parts and
// Finance use one implementation. This module re-exports them and keeps the
// Parts-specific purchase totals math.
//
// (Quotes/Jobs Phase 5–6 persist rounded float dollars. Parts intentionally
// adopts the stricter exact-money representation required for Finance; see
// docs/parts-model.md → "Money".)

export {
  toCents,
  toDollars,
  formatCents,
  isCents,
  lineTotalCents,
} from "@/core/money";

export interface PurchaseTotals {
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
}

/** subtotal = Σ line totals; total = subtotal + shipping + tax. All cents. */
export function computePurchaseTotals(
  lines: Array<{ lineTotal: number }>,
  shipping = 0,
  tax = 0,
): PurchaseTotals {
  const subtotal = lines.reduce(
    (sum, l) => sum + (Number.isSafeInteger(l.lineTotal) ? l.lineTotal : 0),
    0,
  );
  const safeShipping = Math.max(0, Math.trunc(shipping) || 0);
  const safeTax = Math.max(0, Math.trunc(tax) || 0);
  return {
    subtotal,
    shipping: safeShipping,
    tax: safeTax,
    total: subtotal + safeShipping + safeTax,
  };
}
