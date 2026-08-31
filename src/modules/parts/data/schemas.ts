// Parts & Purchasing domain types (Phase 7).
// Interfaces + constant unions only. Validation lives in the repository.
//
// MONEY: every monetary field below is an INTEGER NUMBER OF CENTS (USD).
// See ./money.ts and docs/parts-model.md.

// ---- Part ---------------------------------------------------------------

export type PartStatus = "active" | "discontinued" | "archived";

export const PART_STATUSES: PartStatus[] = [
  "active",
  "discontinued",
  "archived",
];

export interface Part {
  id: string;
  partNumber?: string;
  name: string;
  description?: string;
  manufacturer?: string;
  brand?: string;
  category?: string;
  status: PartStatus;
  preferredSupplierId?: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface CreatePartInput {
  name: string;
  partNumber?: string;
  description?: string;
  manufacturer?: string;
  brand?: string;
  category?: string;
  status?: PartStatus;
  preferredSupplierId?: string;
}

export interface UpdatePartInput {
  name?: string;
  partNumber?: string;
  description?: string;
  manufacturer?: string;
  brand?: string;
  category?: string;
  status?: PartStatus;
  preferredSupplierId?: string | null;
}

export interface PartListQuery {
  /** Matches name, partNumber, brand, manufacturer, category. */
  search?: string;
  partNumber?: string;
  brand?: string;
  manufacturer?: string;
  category?: string;
  status?: PartStatus;
  preferredSupplierId?: string;
  limit?: number;
  cursor?: string;
}

export interface PartListResult {
  items: Part[];
  nextCursor?: string;
}

// ---- Supplier -----------------------------------------------------------

export type SupplierType =
  | "marketplace"
  | "parts_store"
  | "manufacturer"
  | "other";

export const SUPPLIER_TYPES: SupplierType[] = [
  "marketplace",
  "parts_store",
  "manufacturer",
  "other",
];

export interface Supplier {
  id: string;
  name: string;
  type: SupplierType;
  website?: string;
  /** Human label for the account used (e.g. "Shop Amazon"). Never a credential. */
  accountLabel?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface CreateSupplierInput {
  name: string;
  type: SupplierType;
  website?: string;
  accountLabel?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  active?: boolean;
}

export interface UpdateSupplierInput {
  name?: string;
  type?: SupplierType;
  website?: string;
  accountLabel?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  active?: boolean;
}

// ---- Purchase -----------------------------------------------------------

export type PurchaseStatus =
  | "ordered"
  | "shipped"
  | "received"
  | "cancelled"
  | "returned";

export const PURCHASE_STATUSES: PurchaseStatus[] = [
  "ordered",
  "shipped",
  "received",
  "cancelled",
  "returned",
];

export interface Purchase {
  id: string;
  supplierId: string;
  orderNumber?: string;
  status: PurchaseStatus;
  purchasedAt?: number;
  expectedAt?: number;
  receivedAt?: number;
  /** Cents. Σ of purchase line totals. */
  subtotal: number;
  /** Cents. */
  shipping: number;
  /** Cents. */
  tax: number;
  /** Cents. subtotal + shipping + tax. */
  total: number;
  currency: "USD";
  /** Logical storage key only — never a URL or blob. */
  receiptKey?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface CreatePurchaseInput {
  supplierId: string;
  orderNumber?: string;
  status?: PurchaseStatus;
  purchasedAt?: number;
  expectedAt?: number;
  /** Cents. */
  shipping?: number;
  /** Cents. */
  tax?: number;
  receiptKey?: string;
  notes?: string;
  /** Optional lines created atomically with the purchase. */
  lines?: CreatePurchaseLineInput[];
}

export interface UpdatePurchaseInput {
  supplierId?: string;
  orderNumber?: string;
  status?: PurchaseStatus;
  purchasedAt?: number;
  expectedAt?: number;
  receivedAt?: number;
  shipping?: number;
  tax?: number;
  receiptKey?: string;
  notes?: string;
}

export interface PurchaseListQuery {
  supplierId?: string;
  status?: PurchaseStatus;
  /** Epoch ms inclusive bounds on purchasedAt (falls back to createdAt). */
  from?: number;
  to?: number;
  search?: string;
  limit?: number;
  cursor?: string;
}

export interface PurchaseListResult {
  items: Purchase[];
  nextCursor?: string;
}

// ---- Purchase line ------------------------------------------------------

export interface PurchaseLine {
  id: string;
  purchaseId: string;
  partId?: string;
  description: string;
  partNumber?: string;
  quantity: number;
  /** Cents. */
  unitCost: number;
  /** Cents. round(quantity * unitCost). */
  lineTotal: number;
  vehicleId?: string;
  jobId?: string;
  createdAt: number;
}

export interface CreatePurchaseLineInput {
  partId?: string;
  description: string;
  partNumber?: string;
  quantity: number;
  /** Cents. */
  unitCost: number;
  vehicleId?: string;
  jobId?: string;
}

// ---- Part usage ---------------------------------------------------------

export interface PartUsage {
  id: string;
  partId: string;
  vehicleId: string;
  jobId?: string;
  purchaseLineId?: string;
  quantity: number;
  /** Cents. */
  unitCost: number;
  /** Cents. round(quantity * unitCost). */
  totalCost: number;
  usedAt: number;
  notes?: string;
  createdBy: string;
}

export interface CreatePartUsageInput {
  partId: string;
  vehicleId: string;
  jobId?: string;
  purchaseLineId?: string;
  quantity: number;
  /** Cents. */
  unitCost: number;
  usedAt?: number;
  notes?: string;
}

export interface PartUsageQuery {
  partId?: string;
  vehicleId?: string;
  jobId?: string;
  from?: number;
  to?: number;
}

// ---- Vehicle reference --------------------------------------------------

export interface PartVehicleReference {
  id: string;
  partId: string;
  vehicleId: string;
  notes?: string;
  createdAt: number;
}

export interface CreatePartVehicleReferenceInput {
  partId: string;
  vehicleId: string;
  notes?: string;
}
