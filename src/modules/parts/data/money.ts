// Deterministic money helpers for the Parts module.
//
// CONVENTION: every persisted monetary value in Parts is an INTEGER NUMBER
// OF CENTS (USD). No floating-point dollars are ever written to storage.
// Dollars only exist at the UI edge, converted via `toCents` / `formatCents`.
//
// (Quotes/Jobs Phase 5–6 persist rounded float dollars. Parts intentionally
// adopts the stricter exact-money representation required for Finance; see
// docs/parts-model.md → "Money".)

/** Parse a user-entered dollar string/number into integer cents. */
export function toCents(dollars: number | string): number {
  const n = typeof dollars === "string" ? Number(dollars) : dollars;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Integer cents → dollars number (display only, never persisted). */
export function toDollars(cents: number): number {
  return (Number.isFinite(cents) ? Math.trunc(cents) : 0) / 100;
}

export function formatCents(cents: number, currency: "USD" = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(toDollars(cents));
}

/** True when `v` is a safe integer cents amount >= 0. */
export function isCents(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
}

/**
 * Line total in cents. Quantity may be fractional (e.g. 0.5 L of fluid), so
 * the product is rounded half-up to whole cents deterministically.
 */
export function lineTotalCents(quantity: number, unitCostCents: number): number {
  const q = Number.isFinite(quantity) ? quantity : 0;
  const u = Number.isSafeInteger(unitCostCents) ? unitCostCents : 0;
  return Math.round(q * u);
}

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
