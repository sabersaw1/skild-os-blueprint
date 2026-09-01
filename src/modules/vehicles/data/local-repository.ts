// Local in-memory + localStorage implementation of VehicleRepository.
// Repository implementations are the ONLY place allowed to touch storage.

import { newId } from "@/core/ids";
import { readJson, writeJson } from "@/core/storage/local-kv";
import { getIdentity } from "@/core/auth/identity";
import { emit } from "@/core/activity/emitter";
import { getRepository } from "@/core/data/registry";
import { enqueueUpload } from "@/storage/uploadQueue";
import {
  CRM_CUSTOMER_REPOSITORY,
  type CustomerRepository,
} from "@/modules/crm/data/repository";
import type {
  OwnershipRecord,
  Vehicle,
  VehicleCreateInput,
  VehicleListQuery,
  VehicleListResult,
  VehicleRepository,
} from "./repository";
import { assertPersisted } from "@/core/storage/persistence";
import { withCapabilityEnforcement } from "@/core/auth/authorize";

const K_VEHICLES = "skildos.vehicles.vehicles.v1";
const K_OWNERSHIP = "skildos.vehicles.ownership.v1";

function validateCreate(input: VehicleCreateInput): void {
  if (!input.customerId) throw new Error("customerId is required.");
  if (!input.make?.trim()) throw new Error("make is required.");
  if (!input.model?.trim()) throw new Error("model is required.");
  if (input.year !== undefined && (input.year < 1900 || input.year > new Date().getFullYear() + 2)) {
    throw new Error("year is out of range.");
  }
}

function crm(): CustomerRepository {
  return getRepository<CustomerRepository>(CRM_CUSTOMER_REPOSITORY);
}

export function createLocalVehicleRepository(): VehicleRepository {
  let vehicles: Vehicle[] = readJson<Vehicle[]>(K_VEHICLES, []);
  let ownership: OwnershipRecord[] = readJson<OwnershipRecord[]>(K_OWNERSHIP, []);

  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());
  const persistVehicles = () => assertPersisted(K_VEHICLES, writeJson(K_VEHICLES, vehicles));
  const persistOwnership = () => assertPersisted(K_OWNERSHIP, writeJson(K_OWNERSHIP, ownership));
  const findVehicle = (id: string) => vehicles.find((v) => v.id === id);

  const repo: VehicleRepository = {
    async list(q: VehicleListQuery = {}): Promise<VehicleListResult> {
      let items = vehicles.slice();
      if (q.status) items = items.filter((v) => v.status === q.status);
      if (q.customerId) items = items.filter((v) => v.customerId === q.customerId);
      if (q.search) {
        const s = q.search.toLowerCase();
        items = items.filter(
          (v) =>
            v.make.toLowerCase().includes(s) ||
            v.model.toLowerCase().includes(s) ||
            v.vin?.toLowerCase().includes(s) ||
            v.licensePlate?.toLowerCase().includes(s),
        );
      }
      items.sort((a, b) => b.updatedAt - a.updatedAt);
      const limit = q.limit ?? items.length;
      return { items: items.slice(0, limit) };
    },

    async get(id) {
      return findVehicle(id);
    },

    async create(input) {
      validateCreate(input);
      if (input.vin) {
        const clash = vehicles.find((v) => v.vin?.toLowerCase() === input.vin!.toLowerCase());
        if (clash) throw new Error(`A vehicle with VIN ${input.vin} already exists.`);
      }
      const now = Date.now();
      const vehicle: Vehicle = {
        id: newId(),
        customerId: input.customerId,
        make: input.make.trim(),
        model: input.model.trim(),
        year: input.year,
        vin: input.vin?.trim() || undefined,
        licensePlate: input.licensePlate?.trim() || undefined,
        color: input.color?.trim() || undefined,
        photoKeys: [],
        status: "active",
        notes: input.notes?.trim() || undefined,
        createdAt: now,
        updatedAt: now,
        createdBy: getIdentity().id,
      };
      vehicles = [vehicle, ...vehicles];
      persistVehicles();

      const record: OwnershipRecord = {
        id: newId(),
        vehicleId: vehicle.id,
        customerId: input.customerId,
        fromDate: now,
        reason: "initial",
      };
      ownership = [...ownership, record];
      persistOwnership();

      await crm().adjustVehiclesCount(input.customerId, 1);
      notify();
      emit({
        type: "vehicles.vehicle.created",
        moduleId: "vehicles",
        summary: `Added ${vehicle.year ?? ""} ${vehicle.make} ${vehicle.model}`.trim(),
        payload: { vehicleId: vehicle.id, customerId: vehicle.customerId },
      });
      return vehicle;
    },

    async update(id, patch) {
      const existing = findVehicle(id);
      if (!existing) throw new Error(`Vehicle ${id} not found.`);
      const next: Vehicle = {
        ...existing,
        ...patch,
        id: existing.id,
        customerId: existing.customerId,
        createdAt: existing.createdAt,
        createdBy: existing.createdBy,
        updatedAt: Date.now(),
      };
      vehicles = vehicles.map((v) => (v.id === id ? next : v));
      persistVehicles();
      notify();
      emit({
        type: "vehicles.vehicle.updated",
        moduleId: "vehicles",
        summary: `Updated ${next.make} ${next.model}`,
        payload: { vehicleId: id, fields: Object.keys(patch) },
      });
      return next;
    },

    async recordOdometer(id, reading) {
      const existing = findVehicle(id);
      if (!existing) throw new Error(`Vehicle ${id} not found.`);
      if (reading.value < 0) throw new Error("Odometer value must be >= 0.");
      const next: Vehicle = {
        ...existing,
        odometer: { ...reading, recordedAt: Date.now() },
        updatedAt: Date.now(),
      };
      vehicles = vehicles.map((v) => (v.id === id ? next : v));
      persistVehicles();
      notify();
      emit({
        type: "vehicles.odometer.recorded",
        moduleId: "vehicles",
        summary: `Odometer ${reading.value} ${reading.unit} on ${next.make} ${next.model}`,
        payload: { vehicleId: id, value: reading.value, unit: reading.unit },
      });
      return next;
    },

    async transferOwnership(vehicleId, newCustomerId, reason) {
      const existing = findVehicle(vehicleId);
      if (!existing) throw new Error(`Vehicle ${vehicleId} not found.`);
      if (existing.customerId === newCustomerId) {
        throw new Error("Vehicle is already owned by this customer.");
      }
      const now = Date.now();
      // close prior open record
      ownership = ownership.map((r) =>
        r.vehicleId === vehicleId && r.toDate === undefined ? { ...r, toDate: now } : r,
      );
      ownership = [
        ...ownership,
        {
          id: newId(),
          vehicleId,
          customerId: newCustomerId,
          fromDate: now,
          reason: reason ?? "transferred",
        },
      ];
      persistOwnership();

      const previousCustomerId = existing.customerId;
      const next: Vehicle = { ...existing, customerId: newCustomerId, updatedAt: now };
      vehicles = vehicles.map((v) => (v.id === vehicleId ? next : v));
      persistVehicles();

      await crm().adjustVehiclesCount(previousCustomerId, -1);
      await crm().adjustVehiclesCount(newCustomerId, 1);
      notify();
      emit({
        type: "vehicles.ownership.transferred",
        moduleId: "vehicles",
        summary: `Transferred ${existing.make} ${existing.model}`,
        payload: { vehicleId, fromCustomerId: previousCustomerId, toCustomerId: newCustomerId, reason },
      });
      return next;
    },

    async listOwnershipHistory(vehicleId) {
      return ownership
        .filter((r) => r.vehicleId === vehicleId)
        .slice()
        .sort((a, b) => b.fromDate - a.fromDate);
    },

    async queuePhoto(vehicleId, meta) {
      const existing = findVehicle(vehicleId);
      if (!existing) throw new Error(`Vehicle ${vehicleId} not found.`);
      enqueueUpload({
        logicalKey: meta.logicalKey,
        size: meta.size,
        checksum: meta.checksum,
      });
      const next: Vehicle = {
        ...existing,
        photoKeys: [...existing.photoKeys, meta.logicalKey],
        updatedAt: Date.now(),
      };
      vehicles = vehicles.map((v) => (v.id === vehicleId ? next : v));
      persistVehicles();
      notify();
      emit({
        type: "vehicles.photo.queued",
        moduleId: "vehicles",
        summary: `Queued photo for ${existing.make} ${existing.model}`,
        payload: { vehicleId, count: 1, logicalKeys: [meta.logicalKey] },
      });
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  // Phase 15: authorization at the mutation boundary, not only in the UI.
  return withCapabilityEnforcement(repo, {
    create: "vehicles.write",
    update: "vehicles.write",
    recordOdometer: "vehicles.write",
    transferOwnership: "vehicles.transferOwnership",
    queuePhoto: "vehicles.photos.write",
  });
}
