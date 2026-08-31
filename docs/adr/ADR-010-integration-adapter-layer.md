# ADR-010: Integration Adapter Layer

**Status:** Accepted (Phase 9)

## Context

Skild OS will eventually connect to Gmail, Google Calendar, Google Business
Profile, eBay, Amazon, auto-parts suppliers, the public website, and a payment
provider. Wiring any of these directly into business modules would spread
vendor-specific code, credentials, and failure handling across the whole
system. It would also make the OS structurally dependent on providers that get
replaced.

## Decision

All external connectivity goes through a provider-agnostic layer in
`src/core/integrations/`:

- `IntegrationAdapter` is the only vendor-aware code.
- Adapters are resolved from a registry by provider id; business modules never
  construct one.
- Adapters return normalized external records; they never write storage and
  never import a module repository.
- Credentials are referenced by an opaque `CredentialRef`; the core never holds
  secret material, and no browser credential vault exists.
- Capabilities are `integrations.*` only — never per-vendor.
- `ExternalReference` gives every import idempotency; `Provenance` marks
  external data as unverified.

Phase 9 ships one clearly labelled stub adapter (`website`) and nine deferred
adapters that refuse to authorize because no secure server-side credential
backend exists yet.

## Consequences

- Adding a provider is one adapter file plus a registry entry; no module,
  capability, route, or schema changes.
- Replacing or removing a provider cannot corrupt business data, because
  provider records are references, not business records.
- The OS stays the source of truth: providers are sources and destinations.
- Live integrations remain blocked until a server-side secret backend lands.
  That is a deliberate cost, chosen over faking OAuth in the browser.
- Alternatives rejected: per-module provider clients (vendor lock-in spread
  everywhere), per-vendor capabilities (unstable permission surface), and a
  browser-side token vault (insecure by construction).
