import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import {
  useCommunicationRepository,
  useConversation,
  useMessages,
} from "@/modules/communication/hooks";
import { MessageList } from "@/modules/communication/components/MessageList";
import {
  CONVERSATION_STATUSES,
  MESSAGE_TYPES,
  type ConversationStatus,
  type MessageType,
} from "@/modules/communication/data/schemas";
import { formatDenver, SKILD_TIME_ZONE } from "@/modules/communication/data/time";
import { useCustomers } from "@/modules/crm/hooks";

export const Route = createModuleRoute("/conversations/$conversationId")({
  moduleId: "communication",
  head: () => ({
    meta: [
      { title: "Conversation — Skild OS" },
      {
        name: "description",
        content:
          "One customer thread: inbound messages, internal notes, and outbound drafts awaiting human approval.",
      },
      { property: "og:title", content: "Conversation — Skild OS" },
      {
        property: "og:description",
        content:
          "Review a customer thread and prepare outbound replies under human approval.",
      },
    ],
  }),
  component: ConversationDetail,
});

function ConversationDetail() {
  const { conversationId } = Route.useParams();
  const navigate = useNavigate();
  const repo = useCommunicationRepository();
  const { data: conversation, loading } = useConversation(conversationId);
  const { data: messages } = useMessages({ conversationId });
  const { data: customers } = useCustomers();

  const canRead = useHasCapability("communication.read");
  const canWrite = useHasCapability("communication.write");
  const canApprove = useHasCapability("communication.approve");
  const canSend = useHasCapability("communication.send");

  const [inbound, setInbound] = useState("");
  const [note, setNote] = useState("");
  const [reply, setReply] = useState("");
  const [replyType, setReplyType] = useState<MessageType>("general");
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    }
  };

  if (!canRead) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        You do not have permission to view conversations.
      </p>
    );
  }
  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  }
  if (!conversation) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Conversation not found.</p>
        <Button
          variant="ghost"
          className="mt-2"
          onClick={() => navigate({ to: "/conversations" })}
        >
          Back to conversations
        </Button>
      </div>
    );
  }

  const customer = customers.find((c) => c.id === conversation.customerId);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <Link
        to="/conversations"
        className="text-xs text-muted-foreground hover:underline"
      >
        ← All conversations
      </Link>

      <header className="mb-4 mt-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {conversation.subject ?? "Untitled thread"}
        </h1>
        <p className="text-xs text-muted-foreground">
          {customer ? (
            <Link
              to="/customers/$customerId"
              params={{ customerId: conversation.customerId }}
              className="hover:underline"
            >
              {customer.displayName}
            </Link>
          ) : (
            "Customer"
          )}{" "}
          · {conversation.channel}
          {conversation.source ? ` · ${conversation.source}` : ""} · opened{" "}
          {formatDenver(conversation.createdAt)} ({SKILD_TIME_ZONE})
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge>{conversation.status.replace("_", " ")}</Badge>
          <span className="text-xs text-muted-foreground">
            awaiting: {conversation.awaitingParty}
          </span>
          {canWrite && (
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={conversation.status}
              onChange={(e) =>
                void run(() =>
                  repo.setConversationStatus(
                    conversation.id,
                    e.target.value as ConversationStatus,
                  ),
                )
              }
            >
              {CONVERSATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          )}
        </div>
        {conversation.refs.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Linked records:{" "}
            {conversation.refs.map((r) => `${r.type}`).join(", ")}
          </p>
        )}
      </header>

      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium">Thread</h2>
        <MessageList
          messages={messages}
          canApprove={canApprove}
          canSend={canSend}
          onApprove={(id) => void run(() => repo.approveMessage(id))}
          onQueue={(id) => void run(() => repo.queueMessage(id))}
          onCancel={(id) => void run(() => repo.cancelMessage(id))}
        />
      </section>

      {canWrite && (
        <div className="space-y-6">
          <section className="rounded-md border border-border p-3">
            <Label htmlFor="inbound">Record what the customer said</Label>
            <Textarea
              id="inbound"
              className="mt-1"
              rows={3}
              value={inbound}
              onChange={(e) => setInbound(e.target.value)}
              placeholder="Customer called and said the noise is worse when braking downhill…"
            />
            <Button
              className="mt-2"
              size="sm"
              disabled={!inbound.trim()}
              onClick={() =>
                void run(async () => {
                  await repo.recordInboundMessage({
                    conversationId: conversation.id,
                    body: inbound,
                  });
                  setInbound("");
                })
              }
            >
              Record inbound
            </Button>
          </section>

          <section className="rounded-md border border-border p-3">
            <Label htmlFor="reply">Prepare an outbound reply</Label>
            <p className="mb-1 mt-1 text-[11px] text-muted-foreground">
              Nothing is transmitted. Messages are prepared, approved by a
              human, then queued for a future integration adapter.
            </p>
            <select
              className="mb-2 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={replyType}
              onChange={(e) => setReplyType(e.target.value as MessageType)}
            >
              {MESSAGE_TYPES.filter((t) => t !== "internal_note").map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <Textarea
              id="reply"
              rows={3}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Thanks for reaching out — here's what we found…"
            />
            <Button
              className="mt-2"
              size="sm"
              disabled={!reply.trim()}
              onClick={() =>
                void run(async () => {
                  await repo.prepareOutboundMessage({
                    conversationId: conversation.id,
                    body: reply,
                    type: replyType,
                  });
                  setReply("");
                })
              }
            >
              Prepare message
            </Button>
          </section>

          <section className="rounded-md border border-dashed border-border p-3">
            <Label htmlFor="note">Internal note (never customer-visible)</Label>
            <Textarea
              id="note"
              className="mt-1"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button
              className="mt-2"
              size="sm"
              variant="secondary"
              disabled={!note.trim()}
              onClick={() =>
                void run(async () => {
                  await repo.addInternalNote({
                    conversationId: conversation.id,
                    body: note,
                  });
                  setNote("");
                })
              }
            >
              Add note
            </Button>
          </section>
        </div>
      )}
    </div>
  );
}
