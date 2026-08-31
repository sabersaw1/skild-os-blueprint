import { useState } from "react";
import { createModuleRoute } from "@/core/routes/createModuleRoute";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useHasCapability } from "@/core/roles/hooks";
import {
  STATUS_LABELS,
  connectConnection,
  disconnectConnection,
  needsAttention,
  runSync,
  testConnection,
  useIntegrationAdapters,
  useIntegrationConnections,
  useIntegrationRepository,
  type ConnectionStatus,
  type IntegrationConnection,
} from "@/core/integrations";

export const Route = createModuleRoute("/settings/integrations")({
  moduleId: "integrations",
  head: () => ({
    meta: [
      { title: "Integrations — Settings — Skild OS" },
      {
        name: "description",
        content:
          "Manage external provider connections, authorization status, and sync health for Skild OS.",
      },
      { property: "og:title", content: "Integrations — Skild OS" },
      {
        property: "og:description",
        content:
          "External connection health, sync state, and provider adapters for Skild OS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IntegrationsSettings,
});

function statusVariant(
  status: ConnectionStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "connected") return "default";
  if (status === "error" || status === "revoked" || status === "expired")
    return "destructive";
  if (status === "connecting") return "secondary";
  return "outline";
}

function when(ts?: number): string {
  return ts ? new Date(ts).toLocaleString() : "—";
}

function IntegrationsSettings() {
  const adapters = useIntegrationAdapters();
  const repo = useIntegrationRepository();
  const { connections, syncStates, refresh } = useIntegrationConnections();
  const canRead = useHasCapability("integrations.read");
  const canConnect = useHasCapability("integrations.connect");
  const canDisconnect = useHasCapability("integrations.disconnect");
  const canSync = useHasCapability("integrations.sync");
  const canWrite = useHasCapability("integrations.write");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!canRead) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>
            You do not have permission to view external connections.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const act = async (key: string, fn: () => Promise<string>) => {
    setBusy(key);
    setMessage(null);
    try {
      setMessage(await fn());
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const addConnection = (providerId: string, displayName: string) =>
    act(`add:${providerId}`, async () => {
      await repo.createConnection({
        provider: providerId,
        accountLabel: displayName,
        adapterKind: "stub",
      });
      return `Created a connection record for ${displayName}. It is not authorized yet.`;
    });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>External connections</CardTitle>
          <CardDescription>
            Skild OS remains the source of truth. External providers are
            sources and destinations only. Stub adapters are labelled and are
            never real provider connections.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <p
              role="status"
              className="rounded-md border bg-muted/40 px-3 py-2 text-sm"
            >
              {message}
            </p>
          )}

          {connections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No connections yet. Add one from the provider catalog below.
            </p>
          ) : (
            <ul className="divide-y">
              {connections.map((c) => (
                <ConnectionRow
                  key={c.id}
                  connection={c}
                  syncSummary={syncStates
                    .filter((s) => s.integrationId === c.id)
                    .map(
                      (s) =>
                        `${s.resourceType}: ${s.status}${
                          s.lastErrorCode ? ` (${s.lastErrorCode})` : ""
                        }`,
                    )
                    .join(" · ")}
                  busy={busy}
                  canConnect={canConnect}
                  canDisconnect={canDisconnect}
                  canSync={canSync}
                  onConnect={() =>
                    act(`connect:${c.id}`, async () => {
                      const next = await connectConnection(c.id);
                      return next.status === "connected"
                        ? `${c.provider} connected (stub adapter).`
                        : `${c.provider} could not connect: ${next.lastErrorMessage ?? next.status}`;
                    })
                  }
                  onTest={() =>
                    act(`test:${c.id}`, async () => {
                      const r = await testConnection(c.id);
                      return r.detail;
                    })
                  }
                  onDisconnect={() =>
                    act(`disconnect:${c.id}`, async () => {
                      await disconnectConnection(c.id);
                      return `${c.provider} disconnected.`;
                    })
                  }
                  onSync={(resourceType) =>
                    act(`sync:${c.id}`, async () => {
                      const r = await runSync(c.id, resourceType);
                      return `Sync finished: ${r.seen} external records seen, ${r.newRecords} new.`;
                    })
                  }
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Provider catalog</CardTitle>
          <CardDescription>
            Adapters registered with the Integration Registry. Providers marked
            deferred refuse to authorize because no secure server-side
            credential backend is configured yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {adapters.map((a) => (
              <li
                key={a.providerId}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{a.displayName}</span>
                    <code className="text-xs text-muted-foreground">
                      {a.providerId}
                    </code>
                    <Badge variant="outline">
                      {a.capabilities.readResources.length > 0
                        ? "stub adapter"
                        : "deferred"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Sync modes:{" "}
                    {a.capabilities.syncModes.join(", ") || "none"} · Reads:{" "}
                    {a.capabilities.readResources.join(", ") || "none"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!canWrite || busy !== null}
                  onClick={() => addConnection(a.providerId, a.displayName)}
                >
                  Add connection
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function ConnectionRow(props: {
  connection: IntegrationConnection;
  syncSummary: string;
  busy: string | null;
  canConnect: boolean;
  canDisconnect: boolean;
  canSync: boolean;
  onConnect: () => void;
  onTest: () => void;
  onDisconnect: () => void;
  onSync: (resourceType: string) => void;
}) {
  const c = props.connection;
  const disabled = props.busy !== null;

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{c.provider}</span>
        <Badge variant={statusVariant(c.status)}>
          {STATUS_LABELS[c.status]}
        </Badge>
        {c.adapterKind === "stub" && (
          <Badge variant="outline">stub — not a real provider</Badge>
        )}
      </div>
      <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
        <div>
          <dt className="inline">Account: </dt>
          <dd className="inline">{c.accountLabel}</dd>
        </div>
        <div>
          <dt className="inline">Connected: </dt>
          <dd className="inline">{when(c.connectedAt)}</dd>
        </div>
        <div>
          <dt className="inline">Last successful sync: </dt>
          <dd className="inline">{when(c.lastSuccessfulSyncAt)}</dd>
        </div>
        <div>
          <dt className="inline">Sync state: </dt>
          <dd className="inline">{props.syncSummary || "—"}</dd>
        </div>
      </dl>
      {needsAttention(c) && (
        <p className="mt-2 text-xs text-destructive">
          {c.lastErrorCode ?? c.status}: {c.lastErrorMessage ?? "Needs attention."}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={disabled || !props.canConnect || c.status === "connected"}
          onClick={props.onConnect}
        >
          Connect
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || !props.canConnect}
          onClick={props.onTest}
        >
          Test
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || !props.canSync || c.status !== "connected"}
          onClick={() => props.onSync("lead")}
        >
          Sync
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={
            disabled || !props.canDisconnect || c.status === "disconnected"
          }
          onClick={props.onDisconnect}
        >
          Disconnect
        </Button>
      </div>
    </li>
  );
}
