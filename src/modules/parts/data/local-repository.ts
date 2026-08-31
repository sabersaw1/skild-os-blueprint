// Local (localStorage-backed) implementation of PartsRepository.
// Repository implementations are the ONLY place allowed to touch storage.
//
// Storage keys (versioned envelopes — see ./storage.ts):
//   skildos.parts.parts.v1
//   skildos.parts.suppliers.v1
//   skildos.parts.purchases.v1
//   skildos.parts.purchase-lines.v1
//   skildos.parts.usage.v1
//   skildos.parts.vehicle-references.v1
//
// Mutation ordering rule: validate → persist → emit → return.
// All money is integer cents (see ./money.ts).

import { newId } from "@/core/ids";
import { getIdentity } from "@/core/auth/identity";
import { emit } from "@/core/activity/emitter";
import { PART_EVENTS } from "../activity";
import {
  PART_STATUSES,
  PURCHASE_STATUSES,
  SUPPLIER_TYPES,
  type CreatePartInput,
  type CreatePartUsageInput,
  type CreatePartVehicleReferenceInput,
  type CreatePurchaseInput,
  type CreatePurchaseLineInput,
  type CreateSupplierInput,
  type Part,
  type PartListQuery,
  type PartListResult,
  type PartUsage,
  type PartUsageQuery,
  type PartVehicleReference,
  type Purchase,
  type PurchaseLine,
  type PurchaseListQuery,
  type PurchaseListResult,
  type PurchaseStatus,
  type Supplier,
  type UpdatePartInput,
  type UpdatePurchaseInput,
  type UpdateSupplierInput,
} from "./schemas";
import { computePurchaseTotals, lineTotalCents } from "./money";
import type { PartsRepository } from "./repository";
import { readEnvelope, registerVersionedKey, writeEnvelope } from "./storage";

const K_PARTS = "skildos.parts.parts.v1";
const K_SUPPLIERS = "skildos.parts.suppliers.v1";
const K_PURCHASES = "skildos.parts.purchases.v1";
const K_LINES = "skildos.parts.purchase-lines.v1";
const K_USAGE = "skildos.parts.usage.v1";
const K_VEHICLE_REFS = "skildos.parts.vehicle-references.v1";

// Register versioned keys + migration hooks BEFORE any read/write.
// v0 (legacy bare array) → v1 (envelope). Pass-through migrations reserve
// the hook path for future schema changes.
registerVersionedKey<Part>({
  key: K_PARTS,
  currentVersion: 1,
  migrations: { 0: (records) => records as Part[] },
});
registerVersionedKey<Supplier>({
  key: K_SUPPLIERS,
  currentVersion: 1,
  migrations: { 0: (records) => records as Supplier[] },
});
registerVersionedKey<Purchase>({
  key: K_PURCHASES,
  currentVersion: 1,
  migrations: { 0: (records) => records as Purchase[] },
});
registerVersionedKey<PurchaseLine>({
  key: K_LINES,
  currentVersion: 1,
  migrations: { 0: (records) => records as PurchaseLine[] },
});
registerVersionedKey<PartUsage>({
  key: K_USAGE,
  currentVersion: 1,
  migrations: { 0: (records) => records as PartUsage[] },
});
registerVersionedKey<PartVehicleReference>({
  key: K_VEHICLE_REFS,
  currentVersion: 1,
  migrations: { 0: (records) => records as PartVehicleReference[] },
});

// ---- Validation ---------------------------------------------------------

function trimmed(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

function assertCents(value: number | undefined, label: string): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer (cents).`);
  }
}

function validatePartInput(input: CreatePartInput | UpdatePartInput): void {
  if ("name" in input && input.name !== undefined && !input.name.trim()) {
    throw new Error("Part name is required.");
  }
  if (input.status !== undefined && !PART_STATUSES.includes(input.status)) {
    throw new Error(`Invalid part status "${input.status}".`);
  }
}

function validateSupplierInput(
  input: CreateSupplierInput | UpdateSupplierInput,
): void {
  if ("name" in input && input.name !== undefined && !input.name.trim()) {
    throw new Error("Supplier name is required.");
  }
  if (input.type !== undefined && !SUPPLIER_TYPES.includes(input.type)) {
    throw new Error(`Invalid supplier type "${input.type}".`);
  }
  if (input.contactEmail && !/^\S+@\S+\.\S+$/.test(input.contactEmail)) {
    throw new Error("contactEmail is not a valid email address.");
  }
}

function validateLineInput(input: CreatePurchaseLineInput): void {
  if (!input.description?.trim()) {
    throw new Error("Purchase line description is required.");
  }
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error("Purchase line quantity must be > 0.");
  }
  assertCents(input.unitCost, "unitCost");
}

function validatePurchaseStatus(status: PurchaseStatus | undefined): void {
  if (status !== undefined && !PURCHASE_STATUSES.includes(status)) {
    throw new Error(`Invalid purchase status "${status}".`);
  }
}

// ---- Factory ------------------------------------------------------------

export function createLocalPartsRepository(): PartsRepository {
  let parts: Part[] = readEnvelope<Part>(K_PARTS) ?? [];
  let suppliers: Supplier[] = readEnvelope<Supplier>(K_SUPPLIERS) ?? [];
  let purchases: Purchase[] = readEnvelope<Purchase>(K_PURCHASES) ?? [];
  let lines: PurchaseLine[] = readEnvelope<PurchaseLine>(K_LINES) ?? [];
  let usage: PartUsage[] = readEnvelope<PartUsage>(K_USAGE) ?? [];
  let vehicleRefs: PartVehicleReference[] =
    readEnvelope<PartVehicleReference>(K_VEHICLE_REFS) ?? [];

  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  const persistParts = () => writeEnvelope(K_PARTS, parts);
  const persistSuppliers = () => writeEnvelope(K_SUPPLIERS, suppliers);
  const persistPurchases = () => writeEnvelope(K_PURCHASES, purchases);
  const persistLines = () => writeEnvelope(K_LINES, lines);
  const persistUsage = () => writeEnvelope(K_USAGE, usage);
  const persistVehicleRefs = () => writeEnvelope(K_VEHICLE_REFS, vehicleRefs);

  /** Recompute + persist a purchase's derived totals from its lines. */
  function recalcPurchase(purchaseId: string): Purchase {
    const purchase = purchases.find((p) => p.id === purchaseId);
    if (!purchase) throw new Error(`Purchase ${purchaseId} not found.`);
    const own = lines.filter((l) => l.purchaseId === purchaseId);
    const totals = computePurchaseTotals(own, purchase.shipping, purchase.tax);
    const next: Purchase = { ...purchase, ...totals, updatedAt: Date.now() };
    purchases = purchases.map((p) => (p.id === purchaseId ? next : p));
    persistPurchases();
    return next;
  }

  return {
    // ---- Parts ----------------------------------------------------------
    async listParts(query?: PartListQuery): Promise<PartListResult> {
      const q = query ?? {};
      const needle = q.search?.trim().toLowerCase();
      let items = parts.filter((p) => {
        if (q.status && p.status !== q.status) return false;
        if (q.partNumber && p.partNumber !== q.partNumber) return false;
        if (
          q.brand &&
          (p.brand ?? "").toLowerCase() !== q.brand.toLowerCase()
        ) {
          return false;
        }
        if (
          q.manufacturer &&
          (p.manufacturer ?? "").toLowerCase() !== q.manufacturer.toLowerCase()
        ) {
          return false;
        }
        if (
          q.category &&
          (p.category ?? "").toLowerCase() !== q.category.toLowerCase()
        ) {
          return false;
        }
        if (
          q.preferredSupplierId &&
          p.preferredSupplierId !== q.preferredSupplierId
        ) {
          return false;
        }
        if (needle) {
          const hay = [
            p.name,
            p.partNumber,
            p.brand,
            p.manufacturer,
            p.category,
            p.description,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      });
      items = items.sort((a, b) => b.updatedAt - a.updatedAt);
      if (q.limit && items.length > q.limit) {
        const page = items.slice(0, q.limit);
        return { items: page, nextCursor: page[page.length - 1]?.id };
      }
      return { items };
    },

    async getPart(id) {
      return parts.find((p) => p.id === id);
    },

    async createPart(input: CreatePartInput): Promise<Part> {
      validatePartInput(input);
      if (!input.name?.trim()) throw new Error("Part name is required.");
      const now = Date.now();
      const part: Part = {
        id: newId(),
        name: input.name.trim(),
        partNumber: trimmed(input.partNumber),
        description: trimmed(input.description),
        manufacturer: trimmed(input.manufacturer),
        brand: trimmed(input.brand),
        category: trimmed(input.category),
        status: input.status ?? "active",
        preferredSupplierId: trimmed(input.preferredSupplierId),
        createdAt: now,
        updatedAt: now,
        createdBy: getIdentity().id,
      };
      parts = [...parts, part];
      persistParts();
      emit({
        type: PART_EVENTS.partCreated,
        moduleId: "parts",
        summary: `Part created: ${part.name}`,
        payload: { partId: part.id },
      });
      notify();
      return part;
    },

    async updatePart(id, patch: UpdatePartInput): Promise<Part> {
      const existing = parts.find((p) => p.id === id);
      if (!existing) throw new Error(`Part ${id} not found.`);
      validatePartInput(patch);
      const next: Part = {
        ...existing,
        name: patch.name?.trim() ?? existing.name,
        partNumber:
          patch.partNumber !== undefined
            ? trimmed(patch.partNumber)
            : existing.partNumber,
        description:
          patch.description !== undefined
            ? trimmed(patch.description)
            : existing.description,
        manufacturer:
          patch.manufacturer !== undefined
            ? trimmed(patch.manufacturer)
            : existing.manufacturer,
        brand: patch.brand !== undefined ? trimmed(patch.brand) : existing.brand,
        category:
          patch.category !== undefined
            ? trimmed(patch.category)
            : existing.category,
        status: patch.status ?? existing.status,
        preferredSupplierId:
          patch.preferredSupplierId === null
            ? undefined
            : patch.preferredSupplierId !== undefined
              ? trimmed(patch.preferredSupplierId)
              : existing.preferredSupplierId,
        updatedAt: Date.now(),
      };
      parts = parts.map((p) => (p.id === id ? next : p));
      persistParts();
      emit({
        type: PART_EVENTS.partUpdated,
        moduleId: "parts",
        summary: `Part updated: ${next.name}`,
        payload: { partId: next.id },
      });
      notify();
      return next;
    },

    async archivePart(id): Promise<Part> {
      const existing = parts.find((p) => p.id === id);
      if (!existing) throw new Error(`Part ${id} not found.`);
      const next: Part = {
        ...existing,
        status: "archived",
        updatedAt: Date.now(),
      };
      parts = parts.map((p) => (p.id === id ? next : p));
      persistParts();
      emit({
        type: PART_EVENTS.partArchived,
        moduleId: "parts",
        summary: `Part archived: ${next.name}`,
        payload: { partId: next.id },
      });
      notify();
      return next;
    },

    // ---- Suppliers ------------------------------------------------------
    async listSuppliers() {
      return [...suppliers].sort((a, b) => a.name.localeCompare(b.name));
    },

    async getSupplier(id) {
      return suppliers.find((s) => s.id === id);
    },

    async createSupplier(input: CreateSupplierInput): Promise<Supplier> {
      validateSupplierInput(input);
      if (!input.name?.trim()) throw new Error("Supplier name is required.");
      if (!input.type) throw new Error("Supplier type is required.");
      const now = Date.now();
      const supplier: Supplier = {
        id: newId(),
        name: input.name.trim(),
        type: input.type,
        website: trimmed(input.website),
        accountLabel: trimmed(input.accountLabel),
        contactName: trimmed(input.contactName),
        contactEmail: trimmed(input.contactEmail),
        contactPhone: trimmed(input.contactPhone),
        notes: trimmed(input.notes),
        active: input.active ?? true,
        createdAt: now,
        updatedAt: now,
        createdBy: getIdentity().id,
      };
      suppliers = [...suppliers, supplier];
      persistSuppliers();
      emit({
        type: PART_EVENTS.supplierCreated,
        moduleId: "parts",
        summary: `Supplier created: ${supplier.name}`,
        payload: { supplierId: supplier.id },
      });
      notify();
      return supplier;
    },

    async updateSupplier(id, patch: UpdateSupplierInput): Promise<Supplier> {
      const existing = suppliers.find((s) => s.id === id);
      if (!existing) throw new Error(`Supplier ${id} not found.`);
      validateSupplierInput(patch);
      const next: Supplier = {
        ...existing,
        name: patch.name?.trim() ?? existing.name,
        type: patch.type ?? existing.type,
        website:
          patch.website !== undefined ? trimmed(patch.website) : existing.website,
        accountLabel:
          patch.accountLabel !== undefined
            ? trimmed(patch.accountLabel)
            : existing.accountLabel,
        contactName:
          patch.contactName !== undefined
            ? trimmed(patch.contactName)
            : existing.contactName,
        contactEmail:
          patch.contactEmail !== undefined
            ? trimmed(patch.contactEmail)
            : existing.contactEmail,
        contactPhone:
          patch.contactPhone !== undefined
            ? trimmed(patch.contactPhone)
            : existing.contactPhone,
        notes: patch.notes !== undefined ? trimmed(patch.notes) : existing.notes,
        active: patch.active ?? existing.active,
        updatedAt: Date.now(),
      };
      suppliers = suppliers.map((s) => (s.id === id ? next : s));
      persistSuppliers();
      emit({
        type: PART_EVENTS.supplierUpdated,
        moduleId: "parts",
        summary: `Supplier updated: ${next.name}`,
        payload: { supplierId: next.id },
      });
      notify();
      return next;
    },

    // ---- Purchases ------------------------------------------------------
    async listPurchases(query?: PurchaseListQuery): Promise<PurchaseListResult> {
      const q = query ?? {};
      const needle = q.search?.trim().toLowerCase();
      let items = purchases.filter((p) => {
        if (q.supplierId && p.supplierId !== q.supplierId) return false;
        if (q.status && p.status !== q.status) return false;
        const when = p.purchasedAt ?? p.createdAt;
        if (q.from !== undefined && when < q.from) return false;
        if (q.to !== undefined && when > q.to) return false;
        if (needle) {
          const hay = [p.orderNumber, p.notes]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      });
      items = items.sort(
        (a, b) => (b.purchasedAt ?? b.createdAt) - (a.purchasedAt ?? a.createdAt),
      );
      if (q.limit && items.length > q.limit) {
        const page = items.slice(0, q.limit);
        return { items: page, nextCursor: page[page.length - 1]?.id };
      }
      return { items };
    },

    async getPurchase(id) {
      return purchases.find((p) => p.id === id);
    },

    async createPurchase(input: CreatePurchaseInput): Promise<Purchase> {
      if (!input.supplierId?.trim()) throw new Error("supplierId is required.");
      if (!suppliers.some((s) => s.id === input.supplierId.trim())) {
        throw new Error(`Unknown supplier "${input.supplierId}".`);
      }
      validatePurchaseStatus(input.status);
      assertCents(input.shipping, "shipping");
      assertCents(input.tax, "tax");
      (input.lines ?? []).forEach(validateLineInput);

      const now = Date.now();
      const purchaseId = newId();
      const newLines: PurchaseLine[] = (input.lines ?? []).map((l) => ({
        id: newId(),
        purchaseId,
        partId: trimmed(l.partId),
        description: l.description.trim(),
        partNumber: trimmed(l.partNumber),
        quantity: l.quantity,
        unitCost: l.unitCost,
        lineTotal: lineTotalCents(l.quantity, l.unitCost),
        vehicleId: trimmed(l.vehicleId),
        jobId: trimmed(l.jobId),
        createdAt: now,
      }));
      const totals = computePurchaseTotals(
        newLines,
        input.shipping ?? 0,
        input.tax ?? 0,
      );
      const purchase: Purchase = {
        id: purchaseId,
        supplierId: input.supplierId.trim(),
        orderNumber: trimmed(input.orderNumber),
        status: input.status ?? "ordered",
        purchasedAt: input.purchasedAt,
        expectedAt: input.expectedAt,
        receivedAt: input.status === "received" ? now : undefined,
        ...totals,
        currency: "USD",
        receiptKey: trimmed(input.receiptKey),
        notes: trimmed(input.notes),
        createdAt: now,
        updatedAt: now,
        createdBy: getIdentity().id,
      };

      purchases = [...purchases, purchase];
      lines = [...lines, ...newLines];
      persistPurchases();
      persistLines();

      emit({
        type: PART_EVENTS.purchaseCreated,
        moduleId: "parts",
        summary: `Purchase created${purchase.orderNumber ? ` (${purchase.orderNumber})` : ""}`,
        payload: { purchaseId: purchase.id, supplierId: purchase.supplierId },
      });
      newLines.forEach((l) => {
        emit({
          type: PART_EVENTS.purchaseLineAdded,
          moduleId: "parts",
          summary: `Purchase line added: ${l.description}`,
          payload: { purchaseId: purchase.id, purchaseLineId: l.id },
        });
      });
      notify();
      return purchase;
    },

    async updatePurchase(id, patch: UpdatePurchaseInput): Promise<Purchase> {
      const existing = purchases.find((p) => p.id === id);
      if (!existing) throw new Error(`Purchase ${id} not found.`);
      validatePurchaseStatus(patch.status);
      assertCents(patch.shipping, "shipping");
      assertCents(patch.tax, "tax");

      const now = Date.now();
      const status = patch.status ?? existing.status;
      const becameReceived =
        status === "received" && existing.status !== "received";
      const own = lines.filter((l) => l.purchaseId === id);
      const totals = computePurchaseTotals(
        own,
        patch.shipping ?? existing.shipping,
        patch.tax ?? existing.tax,
      );
      const next: Purchase = {
        ...existing,
        supplierId: patch.supplierId?.trim() ?? existing.supplierId,
        orderNumber:
          patch.orderNumber !== undefined
            ? trimmed(patch.orderNumber)
            : existing.orderNumber,
        status,
        purchasedAt: patch.purchasedAt ?? existing.purchasedAt,
        expectedAt: patch.expectedAt ?? existing.expectedAt,
        receivedAt:
          patch.receivedAt ??
          (becameReceived ? now : existing.receivedAt),
        ...totals,
        receiptKey:
          patch.receiptKey !== undefined
            ? trimmed(patch.receiptKey)
            : existing.receiptKey,
        notes: patch.notes !== undefined ? trimmed(patch.notes) : existing.notes,
        updatedAt: now,
      };
      purchases = purchases.map((p) => (p.id === id ? next : p));
      persistPurchases();

      emit({
        type: becameReceived
          ? PART_EVENTS.purchaseReceived
          : PART_EVENTS.purchaseUpdated,
        moduleId: "parts",
        summary: becameReceived
          ? `Purchase received${next.orderNumber ? ` (${next.orderNumber})` : ""}`
          : `Purchase updated${next.orderNumber ? ` (${next.orderNumber})` : ""}`,
        payload: { purchaseId: next.id },
      });
      notify();
      return next;
    },

    // ---- Purchase lines -------------------------------------------------
    async listPurchaseLines(purchaseId) {
      return lines
        .filter((l) => l.purchaseId === purchaseId)
        .sort((a, b) => a.createdAt - b.createdAt);
    },

    async addPurchaseLine(
      purchaseId,
      input: CreatePurchaseLineInput,
    ): Promise<PurchaseLine> {
      if (!purchases.some((p) => p.id === purchaseId)) {
        throw new Error(`Purchase ${purchaseId} not found.`);
      }
      validateLineInput(input);
      const line: PurchaseLine = {
        id: newId(),
        purchaseId,
        partId: trimmed(input.partId),
        description: input.description.trim(),
        partNumber: trimmed(input.partNumber),
        quantity: input.quantity,
        unitCost: input.unitCost,
        lineTotal: lineTotalCents(input.quantity, input.unitCost),
        vehicleId: trimmed(input.vehicleId),
        jobId: trimmed(input.jobId),
        createdAt: Date.now(),
      };
      lines = [...lines, line];
      persistLines();
      recalcPurchase(purchaseId);
      emit({
        type: PART_EVENTS.purchaseLineAdded,
        moduleId: "parts",
        summary: `Purchase line added: ${line.description}`,
        payload: { purchaseId, purchaseLineId: line.id },
      });
      notify();
      return line;
    },

    // ---- Usage ----------------------------------------------------------
    async listUsage(query?: PartUsageQuery) {
      const q = query ?? {};
      return usage
        .filter((u) => {
          if (q.partId && u.partId !== q.partId) return false;
          if (q.vehicleId && u.vehicleId !== q.vehicleId) return false;
          if (q.jobId && u.jobId !== q.jobId) return false;
          if (q.from !== undefined && u.usedAt < q.from) return false;
          if (q.to !== undefined && u.usedAt > q.to) return false;
          return true;
        })
        .sort((a, b) => b.usedAt - a.usedAt);
    },

    async recordUsage(input: CreatePartUsageInput): Promise<PartUsage> {
      if (!input.partId?.trim()) throw new Error("partId is required.");
      if (!input.vehicleId?.trim()) throw new Error("vehicleId is required.");
      if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
        throw new Error("Usage quantity must be > 0.");
      }
      assertCents(input.unitCost, "unitCost");
      const record: PartUsage = {
        id: newId(),
        partId: input.partId.trim(),
        vehicleId: input.vehicleId.trim(),
        jobId: trimmed(input.jobId),
        purchaseLineId: trimmed(input.purchaseLineId),
        quantity: input.quantity,
        unitCost: input.unitCost,
        totalCost: lineTotalCents(input.quantity, input.unitCost),
        usedAt: input.usedAt ?? Date.now(),
        notes: trimmed(input.notes),
        createdBy: getIdentity().id,
      };
      usage = [...usage, record];
      persistUsage();
      emit({
        type: PART_EVENTS.usageRecorded,
        moduleId: "parts",
        summary: "Part usage recorded",
        payload: {
          partUsageId: record.id,
          partId: record.partId,
          vehicleId: record.vehicleId,
          jobId: record.jobId,
        },
      });
      notify();
      return record;
    },

    // ---- Vehicle references ---------------------------------------------
    async listVehicleReferences(partId) {
      return vehicleRefs
        .filter((r) => r.partId === partId)
        .sort((a, b) => b.createdAt - a.createdAt);
    },

    async addVehicleReference(
      input: CreatePartVehicleReferenceInput,
    ): Promise<PartVehicleReference> {
      if (!input.partId?.trim()) throw new Error("partId is required.");
      if (!input.vehicleId?.trim()) throw new Error("vehicleId is required.");
      const ref: PartVehicleReference = {
        id: newId(),
        partId: input.partId.trim(),
        vehicleId: input.vehicleId.trim(),
        notes: trimmed(input.notes),
        createdAt: Date.now(),
      };
      vehicleRefs = [...vehicleRefs, ref];
      persistVehicleRefs();
      emit({
        type: PART_EVENTS.vehicleReferenceAdded,
        moduleId: "parts",
        summary: "Part linked to vehicle",
        payload: {
          partVehicleReferenceId: ref.id,
          partId: ref.partId,
          vehicleId: ref.vehicleId,
        },
      });
      notify();
      return ref;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
