export const VEHICLES_REPOSITORY = "vehicles.vehicleRepository";

export type VehicleStatus = "active" | "sold" | "archived";

export interface OdometerReading {
  value: number;
  unit: "km" | "mi";
  recordedAt: number;
}

export interface Vehicle {
  id: string;
  customerId: string;
  make: string;
  model: string;
  year?: number;
  vin?: string;
  licensePlate?: string;
  color?: string;
  odometer?: OdometerReading;
  photoKeys: string[];
  status: VehicleStatus;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface OwnershipRecord {
  id: string;
  vehicleId: string;
  customerId: string;
  fromDate: number;
  toDate?: number;
  reason?: "sold" | "transferred" | "initial";
}

export interface VehicleListQuery {
  search?: string;
  customerId?: string;
  status?: VehicleStatus;
  limit?: number;
}

export interface VehicleListResult {
  items: Vehicle[];
  nextCursor?: string;
}

export type VehicleCreateInput = {
  customerId: string;
  make: string;
  model: string;
  year?: number;
  vin?: string;
  licensePlate?: string;
  color?: string;
  notes?: string;
};

export interface VehicleRepository {
  list(q?: VehicleListQuery): Promise<VehicleListResult>;
  get(id: string): Promise<Vehicle | undefined>;
  create(input: VehicleCreateInput): Promise<Vehicle>;
  update(id: string, patch: Partial<Omit<Vehicle, "id" | "createdAt" | "createdBy" | "customerId">>): Promise<Vehicle>;
  recordOdometer(id: string, reading: Omit<OdometerReading, "recordedAt">): Promise<Vehicle>;
  transferOwnership(vehicleId: string, newCustomerId: string, reason: OwnershipRecord["reason"]): Promise<Vehicle>;
  listOwnershipHistory(vehicleId: string): Promise<OwnershipRecord[]>;
  queuePhoto(vehicleId: string, meta: { logicalKey: string; size: number; checksum?: string }): Promise<void>;
  subscribe(listener: () => void): () => void;
}
