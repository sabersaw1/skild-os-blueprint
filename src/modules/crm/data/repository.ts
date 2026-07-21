// CRM repository — public interface only.
// The concrete local implementation lives in ./local-repository.ts and is
// registered at bootstrap under CRM_CUSTOMER_REPOSITORY. Consumers (route
// components, hooks, other modules) import ONLY from this file.

export const CRM_CUSTOMER_REPOSITORY = "crm.customerRepository";

export type CustomerKind = "individual" | "business";
export type CustomerStatus = "active" | "archived";

export interface Address {
  id: string;
  label?: string;
  line1: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}

export interface Customer {
  id: string;
  kind: CustomerKind;
  displayName: string;
  businessName?: string;
  firstName?: string;
  lastName?: string;
  primaryEmail?: string;
  primaryPhone?: string;
  addresses: Address[];
  tagIds: string[];
  status: CustomerStatus;
  notesCount: number;
  vehiclesCount: number;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface Contact {
  id: string;
  customerId: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  isPrimary: boolean;
}

export interface Note {
  id: string;
  customerId: string;
  body: string;
  authorId: string;
  createdAt: number;
}

export interface Tag {
  id: string;
  label: string;
  color?: string;
}

export interface CustomerListQuery {
  search?: string;
  tagIds?: string[];
  status?: CustomerStatus;
  limit?: number;
  cursor?: string;
}

export interface CustomerListResult {
  items: Customer[];
  nextCursor?: string;
}

export type CustomerCreateInput = {
  kind: CustomerKind;
  businessName?: string;
  firstName?: string;
  lastName?: string;
  primaryEmail?: string;
  primaryPhone?: string;
  addresses?: Address[];
  tagIds?: string[];
};

export interface CustomerRepository {
  list(q?: CustomerListQuery): Promise<CustomerListResult>;
  get(id: string): Promise<Customer | undefined>;
  create(input: CustomerCreateInput): Promise<Customer>;
  update(id: string, patch: Partial<Omit<Customer, "id" | "createdAt" | "createdBy">>): Promise<Customer>;
  archive(id: string): Promise<Customer>;
  addContact(customerId: string, contact: Omit<Contact, "id" | "customerId">): Promise<Contact>;
  addNote(customerId: string, body: string): Promise<Note>;
  listContacts(customerId: string): Promise<Contact[]>;
  listNotes(customerId: string): Promise<Note[]>;
  listTags(): Promise<Tag[]>;
  upsertTag(tag: Omit<Tag, "id"> & { id?: string }): Promise<Tag>;
  /** Called by the Vehicles module to keep denormalised counts in sync. */
  adjustVehiclesCount(customerId: string, delta: number): Promise<void>;
  /** Subscribe to any change; consumers use this to refresh. */
  subscribe(listener: () => void): () => void;
}
