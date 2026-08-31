// Finance repository — public interface only.
// The concrete local implementation lives in ./local-repository.ts and is
// registered at bootstrap under FINANCE_REPOSITORY. Consumers (route
// components, hooks, other modules) import ONLY from this file.

import type {
  Invoice,
  InvoiceCreateInput,
  InvoiceListQuery,
  InvoiceSnapshot,
  InvoiceUpdateInput,
  IssueInvoiceInput,
  Payment,
  PaymentInput,
  VoidInvoiceInput,
} from "./schemas";

export const FINANCE_REPOSITORY = "finance.repository";

export interface FinanceRepository {
  // Invoices
  listInvoices(query?: InvoiceListQuery): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(input: InvoiceCreateInput): Promise<Invoice>;
  /** Draft-only. Throws once the invoice has been issued. */
  updateInvoice(id: string, patch: InvoiceUpdateInput): Promise<Invoice>;

  // Lifecycle
  issueInvoice(id: string, input?: IssueInvoiceInput): Promise<Invoice>;
  voidInvoice(id: string, input: VoidInvoiceInput): Promise<Invoice>;

  // Snapshots (immutable record of what was billed)
  listSnapshots(invoiceId: string): Promise<InvoiceSnapshot[]>;
  getSnapshot(id: string): Promise<InvoiceSnapshot | undefined>;

  // Payments
  recordPayment(invoiceId: string, input: PaymentInput): Promise<Payment>;
  listPayments(invoiceId: string): Promise<Payment[]>;

  /** Subscribe to any change; consumers use this to refresh. */
  subscribe(listener: () => void): () => void;
}
