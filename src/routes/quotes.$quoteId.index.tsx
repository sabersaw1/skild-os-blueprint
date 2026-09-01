import { Link, useNavigate } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import { useQuote, useQuoteVersions } from "@/modules/quotes/hooks";
import { StatusControls } from "@/modules/quotes/components/StatusControls";
import { VersionHistory } from "@/modules/quotes/components/VersionHistory";
import { useVehicle } from "@/modules/vehicles/hooks";
import { useCustomer } from "@/modules/crm/hooks";

export const Route = createModuleRoute("/quotes/$quoteId/")({
  moduleId: "quotes",
  component: QuoteDetail,
});

const money = (n: number) =>
  n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

function QuoteDetail() {
  const { quoteId } = Route.useParams();
  const navigate = useNavigate();
  const { data: quote, loading } = useQuote(quoteId);
  const { data: versions } = useQuoteVersions(quoteId);
  const { data: vehicle } = useVehicle(quote?.vehicleId);
  const { data: customer } = useCustomer(quote?.customerId);
  const canWrite = useHasCapability("quotes.write");

  if (loading || !quote)
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {quote.title}
          </h1>
          <p className="text-xs text-muted-foreground">
            Status <strong>{quote.status}</strong> · Version{" "}
            {quote.currentVersion} · Updated{" "}
            {new Date(quote.updatedAt).toLocaleString()}
          </p>
        </div>
        {canWrite && quote.status === "draft" && (
          <Button
            variant="outline"
            onClick={() =>
              navigate({
                to: "/quotes/$quoteId/edit",
                params: { quoteId },
              })
            }
          >
            <Pencil className="mr-1 h-4 w-4" /> Edit
          </Button>
        )}
      </header>

      <section className="grid gap-4 sm:grid-cols-3 text-sm">
        <div>
          <h2 className="text-xs font-semibold uppercase text-muted-foreground">
            Customer
          </h2>
          {customer ? (
            <Link
              to="/customers/$customerId"
              params={{ customerId: customer.id }}
              className="text-primary underline"
            >
              {customer.displayName}
            </Link>
          ) : (
            <p className="text-muted-foreground">Unknown</p>
          )}
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase text-muted-foreground">
            Vehicle
          </h2>
          {vehicle ? (
            <Link
              to="/vehicles/$vehicleId"
              params={{ vehicleId: vehicle.id }}
              className="text-primary underline"
            >
              {vehicle.year ? `${vehicle.year} ` : ""}
              {vehicle.make} {vehicle.model}
            </Link>
          ) : (
            <p className="text-muted-foreground">Unknown</p>
          )}
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase text-muted-foreground">
            Inspection
          </h2>
          {quote.inspectionId ? (
            <Link
              to="/inspections/$inspectionId"
              params={{ inspectionId: quote.inspectionId }}
              className="text-primary underline"
            >
              View inspection
            </Link>
          ) : (
            <p className="text-muted-foreground">Not linked</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Line items</h2>
        {quote.lineItems.length === 0 ? (
          <p className="text-xs text-muted-foreground">No line items.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-1">Description</th>
                <th className="py-1">Category</th>
                <th className="py-1 text-right">Qty</th>
                <th className="py-1 text-right">Unit</th>
                <th className="py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {quote.lineItems.map((li) => (
                <tr key={li.id} className="border-b last:border-0">
                  <td className="py-1">{li.description}</td>
                  <td className="py-1 text-muted-foreground">{li.category}</td>
                  <td className="py-1 text-right">{li.quantity}</td>
                  <td className="py-1 text-right">{money(li.unitPriceCents)}</td>
                  <td className="py-1 text-right">{money(li.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <dl className="ml-auto mt-3 grid max-w-sm grid-cols-2 gap-1 text-sm">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="text-right">{money(quote.subtotalCents)}</dd>
          <dt className="text-muted-foreground">Discount</dt>
          <dd className="text-right">−{money(quote.discountCents)}</dd>
          <dt className="text-muted-foreground">Tax</dt>
          <dd className="text-right">{money(quote.taxCents)}</dd>
          <dt className="font-semibold">Total</dt>
          <dd className="text-right font-semibold">{money(quote.totalCents)}</dd>
        </dl>
      </section>

      {quote.notes && (
        <section>
          <h2 className="mb-1 text-sm font-semibold">Notes</h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {quote.notes}
          </p>
        </section>
      )}

      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold">Status</h2>
          <StatusControls quote={quote} />
          {quote.statusHistory.length > 0 && (
            <ol className="mt-3 space-y-1 text-xs text-muted-foreground">
              {quote.statusHistory.map((h, i) => (
                <li key={i}>
                  {new Date(h.at).toLocaleString()} — {h.from} → {h.to}
                  {h.reason ? ` · ${h.reason}` : ""}
                </li>
              ))}
            </ol>
          )}
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold">Version history</h2>
          <VersionHistory versions={versions} />
        </div>
      </section>
    </div>
  );
}
