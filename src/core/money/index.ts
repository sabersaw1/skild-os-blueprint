// Core money primitives — INTEGER CENTS (USD).
//
// Every persisted monetary value in modules adopting this standard is an
// integer number of cents. Floating-point dollars exist only at the UI edge.
// Promoted to core in Phase 8 so Parts and Finance share one implementation
// rather than drifting copies.

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
export function lineTotalCents(quantity: number, unitCents: number): number {
  const q = Number.isFinite(quantity) ? quantity : 0;
  const u = Number.isSafeInteger(unitCents) ? unitCents : 0;
  return Math.round(q * u);
}

/** Throw when `value` is not a valid non-negative integer cents amount. */
export function assertCents(value: unknown, field: string): void {
  if (value === undefined) return;
  if (!isCents(value)) {
    throw new Error(
      `${field} must be a non-negative integer number of cents (got ${String(value)}).`,
    );
  }
}

/**
 * Labor total in cents: fractional hours × integer hourly rate, rounded
 * half-up. Same determinism guarantee as lineTotalCents.
 */
export function laborTotalCents(hours: number, rateCents: number): number {
  return lineTotalCents(hours, rateCents);
}
