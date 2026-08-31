import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import type { Part } from "../data/schemas";

export function PartListItem({
  part,
  supplierLabel,
}: {
  part: Part;
  supplierLabel?: string;
}) {
  return (
    <Link
      to="/parts/$partId"
      params={{ partId: part.id }}
      className="block rounded-md border p-3 transition-colors hover:bg-accent"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{part.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[part.partNumber, part.brand ?? part.manufacturer, part.category]
              .filter(Boolean)
              .join(" · ") || "No part number"}
          </p>
          {supplierLabel && (
            <p className="truncate text-xs text-muted-foreground">
              Preferred: {supplierLabel}
            </p>
          )}
        </div>
        <Badge variant={part.status === "active" ? "default" : "secondary"}>
          {part.status}
        </Badge>
      </div>
    </Link>
  );
}
