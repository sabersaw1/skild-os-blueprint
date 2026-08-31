import { Link, useNavigate } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import { formatCents } from "@/core/money";
import {
  useInvoice,
  useInvoicePayments,
  useInvoiceSnapshots,
} from "@/modules/finance/hooks";
import { InvoiceStatusControls } from "@/modules/finance/components/InvoiceStatusControls";
import { PaymentForm } from "@/modules/finance/components/PaymentForm";
import { useCustomer } from "@/modules/crm/hooks";
import { useVehicle } from "@/modules/vehicles/hooks";

export const Route = createModuleRoute("/invoices/$invoiceId/")({
  moduleId: "finance",
  component: InvoiceDetail,
});

function InvoiceDetail() {
  const { invoiceId } = Route.useParams();
  const navigate = useNavigate();
  const { data: invoice, loading } = useInvoice(invoiceId);
  const { data: payments } = useInvoicePayments(invoiceId);
  const { data: snapshots } = useInvoiceSnapshots(invoiceId);
  const { data: customer } = useCustomer(invoice?.customerId);
  const { data: vehicle } = useVehicle(invoice?.vehicleId);
  const canWrite = useHasCapability("finance.invoice.write");

  if (loading || !invoice)
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {invoice.number}
          </h1>
          <p className="text-xs text-muted-foreground">
            Status <strong>{invoice.status.replace("_", " ")}</strong> ·{" "}
            {invoice.issuedAt
              ? `Issued ${new Date(invoice.issuedAt).toLocaleDateString()}`
              : "Not issued"}
            {invoice.dueAt
              ? ` · Due ${new Date(invoice.dueAt).toLocaleDateString()}`
              : ""}
          </p>
        </div>
        {canWrite && invoice.status === "draft" && (
          <Button
            variant="outline"
            onClick={() =>
              navigate({
                to: "/invoices/$invoiceId/edit",
                params: { invoiceId },
              })
            }
          >
            <Pencil className="mr-1 h-4 w-4" /> Edit
          </Button>
        )}
      </header>

      <section className="grid gap-4 text-sm sm:grid-cols-3">
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
            <p className="text-muted-foreground">Not linked</p>
          )}
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase text-muted-foreground">
            Job
          </h2>
          {invoice.jobId ? (
            <Link
              to="/jobs/$jobId"
              params={{ jobId: invoice.jobId }}
              className="text-primary underline"
            >
              View job
            </Link>
          ) : (
            <p className="text-muted-foreground">Not linked</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Lines</h2>
        {invoice.lines.length === 0 ? (
          <p className="text-xs text-muted-foreground">No lines.</p>
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
              {invoice.lines.map((l) => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="py-1">{l.description}</td>
                  <td className="py-1 text-muted-foreground">{l.category}</td>
                  <td className="py-1 text-right">{l.quantity}</td>
                  <td className="py-1 text-right">{formatCents(l.unitPrice)}</td>
                  <td className="py-1 text-right">{formatCents(l.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <dl className="ml-auto mt-3 grid max-w-sm grid-cols-2 gap-1 text-sm">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="text-right">{formatCents(invoice.subtotal)}</dd>
          <dt className="text-muted-foreground">Discount</dt>
          <dd className="text-right">−{formatCents(invoice.discount)}</dd>
          <dt className="text-muted-foreground">Tax</dt>
          <dd className="text-right">{formatCents(invoice.tax)}</dd>
          <dt className="font-semibold">Total</dt>
          <dd className="text-right font-semibold">
            {formatCents(invoice.total)}
          </dd>
          <dt className="text-muted-foreground">Paid</dt>
          <dd className="text-right">{formatCents(invoice.amountPaid)}</dd>
          <dt className="font-semibold">Balance</dt>
          <dd className="text-right font-semibold">
            {formatCents(invoice.balance)}
          </dd>
        </dl>
      </section>

      {invoice.voidReason && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          Voided {new Date(invoice.voidedAt ?? 0).toLocaleString()} —{" "}
          {invoice.voidReason}
        </p>
      )}

      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold">Status</h2>
          <InvoiceStatusControls invoice={invoice} />
          {snapshots.length > 0 && (
            <ol className="mt-3 space-y-1 text-xs text-muted-foreground">
              {snapshots.map((s) => (
                <li key={s.id}>
                  Snapshot {new Date(s.issuedAt).toLocaleString()} ·{" "}
                  {formatCents(s.invoice.total)}
                </li>
              ))}
            </ol>
          )}
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold">Payments</h2>
          <PaymentForm invoice={invoice} />
          {payments.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              {payments.map((p) => (
                <li key={p.id}>
                  {new Date(p.paidAt).toLocaleDateString()} —{" "}
                  {formatCents(p.amount)} · {p.method}
                  {p.reference ? ` · ${p.reference}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {invoice.notes && (
        <section>
          <h2 className="mb-1 text-sm font-semibold">Notes</h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {invoice.notes}
          </p>
        </section>
      )}
    </div>
  );
}
