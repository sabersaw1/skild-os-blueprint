// Parts repository — public interface only.
// The concrete local implementation lives in ./local-repository.ts and is
// registered at bootstrap under PARTS_REPOSITORY. Consumers (route
// components, hooks, other modules) import ONLY from this file.

import type {
  CreatePartInput,
  CreatePartUsageInput,
  CreatePartVehicleReferenceInput,
  CreatePurchaseInput,
  CreatePurchaseLineInput,
  CreateSupplierInput,
  Part,
  PartListQuery,
  PartListResult,
  PartUsage,
  PartUsageQuery,
  PartVehicleReference,
  Purchase,
  PurchaseLine,
  PurchaseListQuery,
  PurchaseListResult,
  Supplier,
  UpdatePartInput,
  UpdatePurchaseInput,
  UpdateSupplierInput,
} from "./schemas";

export const PARTS_REPOSITORY = "parts.repository";

export interface PartsRepository {
  // Parts
  listParts(query?: PartListQuery): Promise<PartListResult>;
  getPart(id: string): Promise<Part | undefined>;
  createPart(input: CreatePartInput): Promise<Part>;
  updatePart(id: string, patch: UpdatePartInput): Promise<Part>;
  archivePart(id: string): Promise<Part>;

  // Suppliers
  listSuppliers(): Promise<Supplier[]>;
  getSupplier(id: string): Promise<Supplier | undefined>;
  createSupplier(input: CreateSupplierInput): Promise<Supplier>;
  updateSupplier(id: string, patch: UpdateSupplierInput): Promise<Supplier>;

  // Purchases
  listPurchases(query?: PurchaseListQuery): Promise<PurchaseListResult>;
  getPurchase(id: string): Promise<Purchase | undefined>;
  createPurchase(input: CreatePurchaseInput): Promise<Purchase>;
  updatePurchase(id: string, patch: UpdatePurchaseInput): Promise<Purchase>;

  // Purchase lines
  listPurchaseLines(purchaseId: string): Promise<PurchaseLine[]>;
  addPurchaseLine(
    purchaseId: string,
    input: CreatePurchaseLineInput,
  ): Promise<PurchaseLine>;

  // Usage
  listUsage(query?: PartUsageQuery): Promise<PartUsage[]>;
  recordUsage(input: CreatePartUsageInput): Promise<PartUsage>;

  // Vehicle references
  listVehicleReferences(partId: string): Promise<PartVehicleReference[]>;
  addVehicleReference(
    input: CreatePartVehicleReferenceInput,
  ): Promise<PartVehicleReference>;

  /** Subscribe to any change; consumers use this to refresh. */
  subscribe(listener: () => void): () => void;
}
