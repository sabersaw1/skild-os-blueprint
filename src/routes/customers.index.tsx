import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCustomers } from "@/modules/crm/hooks";
import { CustomerListItem } from "@/modules/crm/components/CustomerListItem";

export const Route = createFileRoute("/customers/")({
  component: CustomersIndex,
});

function CustomersIndex() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const query = useMemo(() => ({ search: search || undefined }), [search]);
  const { data, loading } = useCustomers(query);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <Button onClick={() => navigate({ to: "/customers/new" })}>
          <Plus className="mr-1 h-4 w-4" /> New customer
        </Button>
      </header>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search customers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No customers yet.{" "}
            <Link to="/customers/new" className="text-primary underline">
              Create your first one
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((c) => (
            <CustomerListItem key={c.id} customer={c} />
          ))}
        </div>
      )}
    </div>
  );
}
