import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHasCapability } from "@/core/roles/hooks";
import { useQuotesRepository } from "../hooks";
import type { Quote } from "../data/schemas";

export function StatusControls({ quote }: { quote: Quote }) {
  const repo = useQuotesRepository();
  const canApprove = useHasCapability("quotes.approve");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canApprove) return null;

  const run = async (
    action: "send" | "approve" | "decline" | "expire",
  ) => {
    setError(null);
    setBusy(action);
    try {
      const input = reason.trim() ? { reason: reason.trim() } : undefined;
      if (action === "send") await repo.sendQuote(quote.id, input);
      else if (action === "approve") await repo.approveQuote(quote.id, input);
      else if (action === "decline") await repo.declineQuote(quote.id, input);
      else await repo.expireQuote(quote.id, input);
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const canSend = quote.status === "draft";
  const canDecide = quote.status === "sent";

  if (!canSend && !canDecide) {
    return (
      <p className="text-xs text-muted-foreground">
        Status is <strong>{quote.status}</strong> — no further transitions.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Input
        placeholder="Optional reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {canSend && (
          <Button
            size="sm"
            onClick={() => run("send")}
            disabled={busy !== null}
          >
            {busy === "send" ? "Sending…" : "Send"}
          </Button>
        )}
        {canDecide && (
          <>
            <Button
              size="sm"
              onClick={() => run("approve")}
              disabled={busy !== null}
            >
              {busy === "approve" ? "…" : "Approve"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => run("decline")}
              disabled={busy !== null}
            >
              {busy === "decline" ? "…" : "Decline"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => run("expire")}
              disabled={busy !== null}
            >
              {busy === "expire" ? "…" : "Mark expired"}
            </Button>
          </>
        )}
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
