// Quotes domain types.
// Interfaces + constant unions only. Validation lives in the repository
// (see ./local-repository.ts) — no Zod dependency in Phase 5.

// ---- Line items ---------------------------------------------------------

export type LineItemCategory = "labor" | "part" | "fee" | "discount" | "other";

export const LINE_ITEM_CATEGORIES: LineItemCategory[] = [
  "labor",
  "part",
  "fee",
  "discount",
  "other",
];

export interface LineItem {
  id: string;
  description: string;
  category: LineItemCategory;
  quantity: number;
  /** Unit price in INTEGER CENTS (USD). See @/core/money. */
  unitPriceCents: number;
  laborHours?: number;
  /** Free-form reference (SKU, catalog #). No Parts module coupling in Phase 5. */
  partReference?: string;
  /** Computed line total in integer cents: round(quantity * unitPriceCents). */
  totalCents: number;
}

export interface LineItemInput {
  description: string;
  category: LineItemCategory;
  quantity: number;
  /** Unit price in INTEGER CENTS (USD). */
  unitPriceCents: number;
  laborHours?: number;
  partReference?: string;
}

// ---- Quote --------------------------------------------------------------

export type QuoteStatus =
  | "draft"
  | "sent"
  | "approved"
  | "declined"
  | "expired";

export const QUOTE_STATUSES: QuoteStatus[] = [
  "draft",
  "sent",
  "approved",
  "declined",
  "expired",
];

export interface QuoteStatusChange {
  from: QuoteStatus;
  to: QuoteStatus;
  at: number;
  by: string;
  reason?: string;
}

export interface Quote {
  id: string;
  customerId: string;
  vehicleId: string;
  inspectionId?: string;
  title: string;
  status: QuoteStatus;
  lineItems: LineItem[];
  /** Sum of line item totals, in integer cents. */
  subtotalCents: number;
  /** Absolute discount applied after subtotal, in integer cents. */
  discountCents: number;
  /** Absolute tax applied after discount, in integer cents. */
  taxCents: number;
  /** subtotal - discount + tax, in integer cents (never below zero). */
  totalCents: number;
  notes: string;
  /** Append-only trail; also emitted as activity events. */
  statusHistory: QuoteStatusChange[];
  /** Latest version number (1-based). */
  currentVersion: number;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface QuoteCreateInput {
  customerId: string;
  vehicleId: string;
  inspectionId?: string;
  title: string;
  lineItems?: LineItemInput[];
  discountCents?: number;
  taxCents?: number;
  notes?: string;
}

export interface QuoteUpdateInput {
  title?: string;
  inspectionId?: string | null;
  lineItems?: LineItemInput[];
  discountCents?: number;
  taxCents?: number;
  notes?: string;
  /** Required when calling update — versioning is mandatory on edit. */
  changeReason: string;
}

export interface QuoteStatusInput {
  reason?: string;
}

export interface QuoteListQuery {
  customerId?: string;
  vehicleId?: string;
  inspectionId?: string;
  status?: QuoteStatus;
  search?: string;
  limit?: number;
}

// ---- Versions -----------------------------------------------------------

/**
 * Frozen point-in-time snapshot of a Quote. Snapshots omit `statusHistory`
 * and `currentVersion` to keep them tightly scoped to the editable surface.
 */
export interface QuoteSnapshot {
  id: string;
  customerId: string;
  vehicleId: string;
  inspectionId?: string;
  title: string;
  status: QuoteStatus;
  lineItems: LineItem[];
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  notes: string;
}

export interface QuoteVersion {
  id: string;
  quoteId: string;
  versionNumber: number;
  snapshot: QuoteSnapshot;
  changedBy: string;
  changeReason: string;
  createdAt: number;
}

// ---- Totals -------------------------------------------------------------

export interface QuoteTotals {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
}
