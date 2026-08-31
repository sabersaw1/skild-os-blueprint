// Connection state machine.
//
// A failed connection must never appear healthy, and a revoked/expired
// authorization must stay visible. Transitions are explicit; anything not
// listed here is rejected by the repository.

import type { ConnectionStatus, IntegrationConnection } from "./types";

const TRANSITIONS: Record<ConnectionStatus, ConnectionStatus[]> = {
  disconnected: ["connecting", "error"],
  connecting: ["connected", "error", "disconnected", "revoked", "expired"],
  connected: ["disconnected", "error", "revoked", "expired"],
  error: ["connecting", "disconnected", "revoked", "expired"],
  revoked: ["connecting", "disconnected"],
  expired: ["connecting", "disconnected", "revoked"],
};

export function canTransition(
  from: ConnectionStatus,
  to: ConnectionStatus,
): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(
  from: ConnectionStatus,
  to: ConnectionStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Integration connection: illegal status transition "${from}" → "${to}".`,
    );
  }
}

/** Healthy means "safe to make provider calls right now". */
export function isHealthy(connection: IntegrationConnection): boolean {
  return connection.status === "connected";
}

/** True when the operator must act (re-auth, fix config). */
export function needsAttention(connection: IntegrationConnection): boolean {
  return (
    connection.status === "error" ||
    connection.status === "revoked" ||
    connection.status === "expired"
  );
}

export const STATUS_LABELS: Record<ConnectionStatus, string> = {
  disconnected: "Disconnected",
  connecting: "Connecting",
  connected: "Connected",
  error: "Error",
  revoked: "Revoked",
  expired: "Expired",
};
