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
  unitPrice: number;
  laborHours?: number;
  /** Free-form reference (SKU, catalog #). No Parts module coupling in Phase 5. */
  partReference?: string;
  /** Computed line total: quantity * unitPrice (rounded to 2 dp). */
  total: number;
}

export interface LineItemInput {
  description: string;
  category: LineItemCategory;
  quantity: number;
  unitPrice: number;
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
  /** Sum of line item totals. */
  subtotal: number;
  /** Absolute currency discount applied after subtotal. */
  discount: number;
  /** Absolute currency tax applied after discount. */
  tax: number;
  /** subtotal - discount + tax (rounded to 2 dp). */
  total: number;
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
  discount?: number;
  tax?: number;
  notes?: string;
}

export interface QuoteUpdateInput {
  title?: string;
  inspectionId?: string | null;
  lineItems?: LineItemInput[];
  discount?: number;
  tax?: number;
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
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
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
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}
