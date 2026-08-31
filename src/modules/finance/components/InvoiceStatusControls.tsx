import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHasCapability } from "@/core/roles/hooks";
import { useFinanceRepository } from "../hooks";
import type { Invoice } from "../data/schemas";

export function InvoiceStatusControls({ invoice }: { invoice: Invoice }) {
  const repo = useFinanceRepository();
  const canIssue = useHasCapability("finance.invoice.issue");
  const canVoid = useHasCapability("finance.invoice.void");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: "issue" | "void") => {
    setError(null);
    setBusy(action);
    try {
      if (action === "issue") await repo.issueInvoice(invoice.id);
      else await repo.voidInvoice(invoice.id, { reason: reason.trim() });
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const showIssue = canIssue && invoice.status === "draft";
  const showVoid =
    canVoid && invoice.status !== "draft" && invoice.status !== "void";

  if (!showIssue && !showVoid) {
    return (
      <p className="text-xs text-muted-foreground">
        Status is <strong>{invoice.status.replace("_", " ")}</strong> — no
        further transitions available.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {showIssue && (
        <div>
          <Button size="sm" onClick={() => run("issue")} disabled={busy !== null}>
            {busy === "issue" ? "Issuing…" : "Issue invoice"}
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">
            Issuing freezes the lines and totals as an immutable record.
          </p>
        </div>
      )}
      {showVoid && (
        <div className="space-y-2">
          <Input
            placeholder="Void reason (required)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => run("void")}
            disabled={busy !== null || !reason.trim()}
          >
            {busy === "void" ? "Voiding…" : "Void invoice"}
          </Button>
        </div>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
