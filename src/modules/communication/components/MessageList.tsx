import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Message } from "../data/schemas";
import { formatDenver } from "../data/time";

export function MessageList({
  messages,
  canApprove,
  canSend,
  onApprove,
  onQueue,
  onCancel,
}: {
  messages: Message[];
  canApprove: boolean;
  canSend: boolean;
  onApprove: (id: string) => void;
  onQueue: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  if (messages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No messages on this thread yet.</p>
    );
  }

  return (
    <ol className="space-y-3">
      {messages.map((m) => (
        <li
          key={m.id}
          className={
            "rounded-md border p-3 " +
            (m.direction === "outbound"
              ? "border-primary/40 bg-primary/5"
              : m.direction === "internal"
                ? "border-dashed border-border bg-muted/40"
                : "border-border")
          }
        >
          <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] uppercase text-muted-foreground">
            <span>{m.direction}</span>
            <span>· {m.channel}</span>
            <span>· {m.type.replace(/_/g, " ")}</span>
            <Badge variant="secondary">{m.status.replace("_", " ")}</Badge>
            <span className="ml-auto normal-case">{formatDenver(m.createdAt)}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm">{m.body}</p>
          {m.refs.length > 0 && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              about: {m.refs.map((r) => `${r.type}`).join(", ")}
            </p>
          )}
          {m.failureReason && (
            <p className="mt-1 text-[11px] text-destructive">{m.failureReason}</p>
          )}

          {m.direction === "outbound" &&
            ["draft", "pending_approval", "approved"].includes(m.status) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {m.status === "pending_approval" && canApprove && (
                  <Button size="sm" onClick={() => onApprove(m.id)}>
                    Approve
                  </Button>
                )}
                {(m.status === "approved" ||
                  (m.status === "draft" && !m.requiresApproval)) &&
                  canSend && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onQueue(m.id)}
                    >
                      Queue for delivery
                    </Button>
                  )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onCancel(m.id)}
                >
                  Cancel
                </Button>
              </div>
            )}
          {m.status === "queued" && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Queued. No delivery channel is connected — an integration adapter
              will transmit and report the result in a later phase.
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
