import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Archive, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCustomer, useCustomerRepository } from "@/modules/crm/hooks";
import { useVehicles } from "@/modules/vehicles/hooks";
import { VehicleListItem } from "@/modules/vehicles/components/VehicleListItem";
import type { Note } from "@/modules/crm/data/repository";

export const Route = createFileRoute("/customers/$customerId/")({
  component: CustomerDetail,
});

function CustomerDetail() {
  const { customerId } = Route.useParams();
  const navigate = useNavigate();
  const repo = useCustomerRepository();
  const { data: customer, loading } = useCustomer(customerId);
  const { data: vehicles } = useVehicles({ customerId });
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteBody, setNoteBody] = useState("");

  useEffect(() => {
    void repo.listNotes(customerId).then(setNotes);
  }, [repo, customerId, customer?.notesCount]);

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!customer)
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Customer not found.</p>
        <Link to="/customers" className="text-primary underline">Back to customers</Link>
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{customer.displayName}</h1>
          <p className="text-sm text-muted-foreground">
            {customer.kind === "business" ? "Business" : "Individual"}
            {customer.status === "archived" && " · Archived"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {customer.primaryEmail || "—"} · {customer.primaryPhone || "—"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              navigate({ to: "/customers/$customerId/edit", params: { customerId } })
            }
          >
            <Pencil className="mr-1 h-4 w-4" /> Edit
          </Button>
          {customer.status !== "archived" && (
            <Button
              variant="outline"
              onClick={async () => {
                if (confirm("Archive this customer?")) await repo.archive(customerId);
              }}
            >
              <Archive className="mr-1 h-4 w-4" /> Archive
            </Button>
          )}
        </div>
      </header>

      <section className="mb-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-medium">Vehicles ({vehicles.length})</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              navigate({ to: "/vehicles/new", search: { customerId } })
            }
          >
            <Plus className="mr-1 h-4 w-4" /> Add vehicle
          </Button>
        </div>
        {vehicles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No vehicles yet.</p>
        ) : (
          <div className="space-y-2">
            {vehicles.map((v) => (
              <VehicleListItem key={v.id} vehicle={v} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-base font-medium">Notes ({notes.length})</h2>
        <form
          className="mb-3 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!noteBody.trim()) return;
            await repo.addNote(customerId, noteBody);
            setNoteBody("");
          }}
        >
          <Textarea
            rows={2}
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="Add a note…"
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={!noteBody.trim()}>
              Add note
            </Button>
          </div>
        </form>
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-md border border-border bg-card p-3 text-sm">
              <p className="whitespace-pre-wrap">{n.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(n.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
