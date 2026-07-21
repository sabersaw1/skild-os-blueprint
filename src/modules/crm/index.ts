// CRM module manifest + bootstrap.
// Importing this file registers the module and its local repository.

import { registerModule } from "@/core/modules/registry";
import { registerRepository } from "@/core/data/registry";
import { registerCapability } from "@/core/roles/roles";
import { CRM_CUSTOMER_REPOSITORY } from "./data/repository";
import { createLocalCustomerRepository } from "./data/local-repository";

let registered = false;

export function registerCrmModule(): void {
  if (registered) return;
  registered = true;

  // Register the local repository under the DI key. Later phases swap this
  // for a Supabase / local-server implementation with no component edits.
  registerRepository(CRM_CUSTOMER_REPOSITORY, createLocalCustomerRepository());

  // Backwards-compatibility aliases requested in the hardening pass.
  // Behaviourally identical to crm.read / crm.write today; documented in
  // docs/modules/crm.md.
  registerCapability({
    id: "customers.read",
    description: "Alias of crm.read (compatibility).",
    ownerModuleId: "crm",
  });
  registerCapability({
    id: "customers.write",
    description: "Alias of crm.write (compatibility).",
    ownerModuleId: "crm",
  });

  registerModule({
    id: "crm",
    label: "CRM",
    description: "Customers, contacts, notes, and tags.",
    capabilities: [
      { id: "crm.read", description: "View customers, contacts, notes, tags.", ownerModuleId: "crm" },
      { id: "crm.write", description: "Create or edit customers, contacts, tags.", ownerModuleId: "crm" },
      { id: "crm.archive", description: "Archive customers.", ownerModuleId: "crm" },
      { id: "crm.notes.write", description: "Append notes to a customer.", ownerModuleId: "crm" },
    ],
    navEntries: [
      {
        id: "crm.nav",
        label: "Customers",
        route: "/customers",
        icon: "Users",
        order: 10,
        requiredCapabilityIds: ["crm.read"],
      },
    ],
    commands: [
      {
        id: "crm.customer.new",
        label: "New customer",
        group: "CRM",
        keywords: ["create", "add", "customer"],
        requiredCapabilityIds: ["crm.write"],
        run: () => window.location.assign("/customers/new"),
      },
      {
        id: "crm.goto",
        label: "Go to Customers",
        group: "Navigate",
        requiredCapabilityIds: ["crm.read"],
        run: () => window.location.assign("/customers"),
      },
    ],
  });
}
