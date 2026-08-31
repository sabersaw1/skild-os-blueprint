# Integration Security

## Hard rules

1. OAuth client secrets, refresh tokens, access tokens, API keys, and
   passwords are **never** stored in business records, connection records,
   activity events, logs, or browser-visible state.
2. The core only holds a `CredentialRef` — `{ backend, handle }`, an opaque,
   non-secret pointer.
3. **There is no browser credential vault, and there will never be one.**
   Storing provider secrets in `localStorage` is insecure by construction.

## Deferred: production secret storage

The default resolver (`createNullCredentialResolver`) supports no provider and
throws `configuration_missing` on `store()` and `resolve()`. This is why every
live provider is deferred: without a secure server-side secret backend there
is no safe place to hold an OAuth token, so Phase 9 does not pretend to
authorize one.

When a server-side vault lands, implement `CredentialResolver` and register it
with `setCredentialResolver(...)`. Nothing else in the integration layer
changes.

## Backstop

`assertNoSecretMaterial(value, context)` walks any object about to be
persisted or emitted and throws when a field name looks like secret material
(`token`, `secret`, `password`, `apikey`, `refresh`, `authorization`,
`bearer`, `client_secret`). It runs on connection create/update, status
changes, and external-reference writes. It is a backstop, not a substitute for
the rules above.

## Capabilities

Provider-agnostic, registered by the Integrations module:

- `integrations.read` — view connections and health
- `integrations.write` — create/edit connection records
- `integrations.connect` — authorize a provider
- `integrations.disconnect` — disconnect or revoke
- `integrations.sync` — run/retry synchronization

There are no per-vendor capabilities. Role names are never checked in code.
Future agents must act through these capabilities, never through raw provider
credentials.

## Errors

Codes are provider-neutral: `authentication_failed`,
`authorization_revoked`, `rate_limited`, `provider_unavailable`,
`invalid_request`, `sync_failed`, `unsupported_operation`,
`configuration_missing`. `IntegrationError.toSafeJSON()` is the only shape put
into activity payloads and UI.

## Review performed (Phase 9)

- No credentials committed to source — the repo contains no provider keys.
- No secrets in connection records — asserted by test against the persisted
  envelope contents.
- No tokens in activity events — asserted by scanning every emitted payload.
- No provider passwords stored, and no credential path to `localStorage`.
- Capability checks present on every UI action.
- A connection cannot falsely claim success: adapter failures force `error`,
  and only `connecting → connected` reaches a healthy state.
- Error messages carry codes and safe text only.
