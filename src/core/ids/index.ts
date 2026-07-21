// ID generation standard for Skild OS.
//
// Every entity id in the system MUST be produced by `newId()`. This centralizes:
//   * UUID v4 semantics (RFC 4122 variant 10, version 0100).
//   * Crypto-backed randomness when available, with a documented fallback.
//   * A single place to swap generation later (e.g. UUIDv7 for time-sortable
//     ids) without touching call sites.
//
// Rules (enforced by review — see docs/architecture/id-strategy.md):
//   1. Never use array indexes as ids.
//   2. Never use timestamps as ids.
//   3. Never concatenate business fields (name, plate, VIN) into an id.
//   4. Ids are opaque strings — do not parse them.

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fallbackUuidV4(): string {
  // RFC 4122-compliant v4 built from Math.random. Only used when crypto is
  // unavailable (very old runtimes / test stubs). Not cryptographically strong.
  const bytes = new Array<number>(16);
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0"));
  return (
    hex.slice(0, 4).join("") +
    "-" +
    hex.slice(4, 6).join("") +
    "-" +
    hex.slice(6, 8).join("") +
    "-" +
    hex.slice(8, 10).join("") +
    "-" +
    hex.slice(10, 16).join("")
  );
}

/** Return a fresh UUID v4 string. */
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return fallbackUuidV4();
}

/** True when `value` is a syntactically valid UUID v4. */
export function isUuidV4(value: unknown): value is string {
  return typeof value === "string" && UUID_V4_RE.test(value);
}
