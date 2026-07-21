import { Link } from "@tanstack/react-router";
import { Users, Building2 } from "lucide-react";
import type { Customer } from "../data/repository";

export function CustomerListItem({ customer }: { customer: Customer }) {
  const Icon = customer.kind === "business" ? Building2 : Users;
  return (
    <Link
      to="/customers/$customerId"
      params={{ customerId: customer.id }}
      className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2 transition-colors hover:bg-accent"
    >
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block truncate text-sm font-medium">
          {customer.displayName}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {customer.primaryEmail || customer.primaryPhone || "—"}
        </span>
      </span>
      {customer.status === "archived" && (
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
          Archived
        </span>
      )}
    </Link>
  );
}
