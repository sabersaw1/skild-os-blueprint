import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PART_STATUSES, type PartStatus } from "../data/schemas";

export interface PartSearchValue {
  search: string;
  status: PartStatus | "all";
  brand: string;
  category: string;
}

export function PartSearch({
  value,
  onChange,
}: {
  value: PartSearchValue;
  onChange: (next: PartSearchValue) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search name, part number, brand…"
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
        />
      </div>
      <Input
        className="w-[150px]"
        placeholder="Brand"
        value={value.brand}
        onChange={(e) => onChange({ ...value, brand: e.target.value })}
      />
      <Input
        className="w-[150px]"
        placeholder="Category"
        value={value.category}
        onChange={(e) => onChange({ ...value, category: e.target.value })}
      />
      <Select
        value={value.status}
        onValueChange={(v) =>
          onChange({ ...value, status: v as PartSearchValue["status"] })
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {PART_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
