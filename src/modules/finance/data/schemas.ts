// Finance / Invoicing domain types.
// Interfaces + constant unions only. Validation lives in the repository
// (see ./local-repository.ts).
//
// MONEY RULE: every monetary field below is an INTEGER NUMBER OF CENTS (USD).
// See docs/finance-model.md.

export type InvoiceStatus =
  | "draft"
  | "issued"
  | "partially_paid"
  | "paid"
  | "void";

export const INVOICE_STATUSES: InvoiceStatus[] = [
  "draft",
  "issued",
  "partially_paid",
  "paid",
  "void",
];

/** Statuses where the invoice is a legal, immutable financial record. */
export const ISSUED_STATUSES: InvoiceStatus[] = [
  "issued",
  "partially_paid",
  "paid",
  "void",
];

export type InvoiceLineCategory = "labor" | "part" | "fee" | "discount" | "other";

export const INVOICE_LINE_CATEGORIES: InvoiceLineCategory[] = [
  "labor",
  "part",
  "fee",
  "discount",
  "other",
];

export type PaymentMethod =
  | "cash"
  | "card"
  | "check"
  | "transfer"
  | "other";

export const PAYMENT_METHODS: PaymentMethod[] = [
  "cash",
  "card",
  "check",
  "transfer",
  "other",
];

export interface InvoiceLine {
  id: string;
  description: string;
  category: InvoiceLineCategory;
  /** May be fractional (0.5 h of labor, 1.5 L of fluid). */
  quantity: number;
  /** Integer cents. */
  unitPrice: number;
  /** Integer cents — round(quantity * unitPrice). */
  lineTotal: number;
  /** Optional provenance links (no cross-module imports; ids only). */
  partId?: string;
  jobId?: string;
  quoteId?: string;
}

export interface Invoice {
  id: string;
  /** Human-readable sequential number, e.g. "INV-0007". Assigned at create. */
  number: string;
  customerId: string;
  vehicleId?: string;
  jobId?: string;
  quoteId?: string;
  status: InvoiceStatus;
  currency: "USD";
  lines: InvoiceLine[];
  /** Integer cents. */
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  /** Integer cents — sum of recorded payments. */
  amountPaid: number;
  /** Integer cents — total - amountPaid (never negative). */
  balance: number;
  terms?: string;
  notes?: string;
  /** epoch ms — set when the invoice is issued. */
  issuedAt?: number;
  dueAt?: number;
  paidAt?: number;
  voidedAt?: number;
  voidReason?: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

/**
 * Immutable snapshot written at issue time. The snapshot — not the live
 * invoice row — is the financial record of what the customer was billed.
 */
export interface InvoiceSnapshot {
  id: string;
  invoiceId: string;
  number: string;
  issuedAt: number;
  issuedBy: string;
  /** Deep-frozen copy of the invoice at issue time. */
  invoice: Invoice;
}

export interface Payment {
  id: string;
  invoiceId: string;
  /** Integer cents, > 0. */
  amount: number;
  method: PaymentMethod;
  reference?: string;
  note?: string;
  /** epoch ms. */
  paidAt: number;
  createdAt: number;
  createdBy: string;
}

// ---- Inputs -------------------------------------------------------------

export interface InvoiceLineInput {
  description: string;
  category?: InvoiceLineCategory;
  quantity: number;
  /** Integer cents. */
  unitPrice: number;
  partId?: string;
  jobId?: string;
  quoteId?: string;
}

export interface InvoiceCreateInput {
  customerId: string;
  vehicleId?: string;
  jobId?: string;
  quoteId?: string;
  lines?: InvoiceLineInput[];
  /** Integer cents. */
  discount?: number;
  tax?: number;
  terms?: string;
  notes?: string;
  dueAt?: number;
}

export interface InvoiceUpdateInput {
  vehicleId?: string | null;
  jobId?: string | null;
  quoteId?: string | null;
  lines?: InvoiceLineInput[];
  discount?: number;
  tax?: number;
  terms?: string;
  notes?: string;
  dueAt?: number | null;
}

export interface IssueInvoiceInput {
  /** epoch ms; defaults to issue time + 14 days. */
  dueAt?: number;
  note?: string;
}

export interface VoidInvoiceInput {
  reason: string;
}

export interface PaymentInput {
  /** Integer cents, > 0. */
  amount: number;
  method: PaymentMethod;
  reference?: string;
  note?: string;
  paidAt?: number;
}

export interface InvoiceListQuery {
  customerId?: string;
  vehicleId?: string;
  jobId?: string;
  quoteId?: string;
  status?: InvoiceStatus;
  /** Only invoices with a positive outstanding balance. */
  outstandingOnly?: boolean;
  /** Issued/created between these epoch-ms bounds. */
  from?: number;
  to?: number;
  search?: string;
  limit?: number;
}

export interface InvoiceTotals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}
