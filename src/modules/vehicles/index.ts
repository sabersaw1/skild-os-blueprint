// Vehicles module manifest + bootstrap.
// Depends on CRM only via CRM_CUSTOMER_REPOSITORY (interface + registry key).
// It does NOT import from src/modules/crm/data/local-repository.

import { registerModule } from "@/core/modules/registry";
import { registerRepository } from "@/core/data/registry";
import { VEHICLES_REPOSITORY } from "./data/repository";
import { createLocalVehicleRepository } from "./data/local-repository";

let registered = false;

export function registerVehiclesModule(): void {
  if (registered) return;
  registered = true;

  registerRepository(VEHICLES_REPOSITORY, createLocalVehicleRepository());

  registerModule({
    id: "vehicles",
    label: "Vehicles",
    description: "Vehicle records owned by customers.",
    capabilities: [
      { id: "vehicles.read", description: "View vehicles.", ownerModuleId: "vehicles" },
      { id: "vehicles.write", description: "Create or edit vehicles.", ownerModuleId: "vehicles" },
      {
        id: "vehicles.photos.write",
        description: "Attach photos to a vehicle (via the Upload Queue).",
        ownerModuleId: "vehicles",
      },
      {
        id: "vehicles.transferOwnership",
        description: "Transfer a vehicle to another customer.",
        ownerModuleId: "vehicles",
      },
    ],
    navEntries: [
      {
        id: "vehicles.nav",
        label: "Vehicles",
        route: "/vehicles",
        icon: "Car",
        order: 20,
        requiredCapabilityIds: ["vehicles.read"],
      },
    ],
    commands: [
      {
        id: "vehicles.vehicle.new",
        label: "New vehicle",
        group: "Vehicles",
        keywords: ["create", "add", "vehicle", "car"],
        requiredCapabilityIds: ["vehicles.write"],
        run: () => window.location.assign("/vehicles/new"),
      },
      {
        id: "vehicles.goto",
        label: "Go to Vehicles",
        group: "Navigate",
        requiredCapabilityIds: ["vehicles.read"],
        run: () => window.location.assign("/vehicles"),
      },
    ],
  });
}
