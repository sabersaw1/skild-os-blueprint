import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import { useHasCapability } from "@/core/roles/hooks";
import { useConversations } from "@/modules/communication/hooks";
import { ConversationListItem } from "@/modules/communication/components/ConversationListItem";
import {
  CONVERSATION_STATUSES,
  type ConversationStatus,
} from "@/modules/communication/data/schemas";
import { useCustomers } from "@/modules/crm/hooks";

export const Route = createModuleRoute("/conversations/")({
  moduleId: "communication",
  head: () => ({
    meta: [
      { title: "All Conversations — Skild OS" },
      {
        name: "description",
        content:
          "Browse every customer conversation by channel, status, and who is waiting on a reply.",
      },
      { property: "og:title", content: "All Conversations — Skild OS" },
      {
        property: "og:description",
        content:
          "Filter customer threads by status and spot conversations waiting on a response.",
      },
    ],
  }),
  component: ConversationsIndex,
});

function ConversationsIndex() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ConversationStatus | "all">("all");

  const query = useMemo(
    () => ({
      search: search || undefined,
      status: status === "all" ? undefined : status,
    }),
    [search, status],
  );

  const { data, loading } = useConversations(query);
  const { data: customers } = useCustomers();
  const canRead = useHasCapability("communication.read");
  const canWrite = useHasCapability("communication.write");

  const customerName = (id: string) =>
    customers.find((c) => c.id === id)?.displayName;

  const awaitingUs = data.filter((c) => c.awaitingParty === "skild").length;

  if (!canRead) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        You do not have permission to view conversations.
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conversations</h1>
          <p className="text-xs text-muted-foreground">
            {data.length} thread{data.length === 1 ? "" : "s"} · {awaitingUs}{" "}
            awaiting our reply
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => navigate({ to: "/conversations/new" })}>
            <Plus className="mr-1 h-4 w-4" /> New conversation
          </Button>
        )}
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          placeholder="Search subject or source…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={status}
          onChange={(e) =>
            setStatus(e.target.value as ConversationStatus | "all")
          }
        >
          <option value="all">All statuses</option>
          {CONVERSATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No conversations yet. Threads recorded here reference existing
          customers and vehicles — nothing is duplicated.
        </p>
      ) : (
        <ul className="space-y-2">
          {data.map((c) => (
            <ConversationListItem
              key={c.id}
              conversation={c}
              customerLabel={customerName(c.customerId)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
