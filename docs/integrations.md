# Integrations (Phase 9)

Skild OS connects to external systems through **adapters**. The OS owns its
business records; providers are sources and destinations only.

## Where things live

```
src/core/integrations/
  types.ts             connection, sync state, external reference, provenance
  adapter.ts           IntegrationAdapter contract
  registry.ts          adapter registry (resolve by provider id)
  repository.ts        IntegrationRepository interface
  local-repository.ts  durable implementation (versioned envelopes)
  service.ts           connect / disconnect / test / runSync orchestration
  connection-state.ts  status machine
  credentials/         CredentialRef + resolver contract (null by default)
  capabilities.ts      integrations.* capabilities
  activity.ts          immutable event names
  errors.ts            provider-agnostic error codes
  adapters/            stub + deferred adapters
  hooks.ts             React hooks for the UI
  module.ts            manifest + bootstrap registration
```

UI: `/settings/integrations` (Settings → Integrations).

## What Phase 9 actually ships

| Provider | State |
| --- | --- |
| `website` | **STUB adapter.** Local only, returns one sample record. Clearly labelled in the UI. |
| `google.gmail`, `google.calendar`, `google.business`, `ebay`, `amazon`, `autozone`, `advance_auto`, `oreilly`, `payment_provider` | **DEFERRED.** Registered adapters that refuse to authorize (`configuration_missing`) because no secure server-side credential backend exists. |

There are **no real connections** in Phase 9. No OAuth is faked.

## Explicitly NOT implemented in Phase 9

- Autonomous AI / Jarvis
- Lead Machine
- Marketing automation
- Gmail ingestion (receipts, messages)
- Supplier scraping or browser automation
- Autonomous purchasing, payments, or refunds
- Customer messaging automation
- Public content publishing

## Adding a provider later

1. Implement `IntegrationAdapter` under `adapters/`.
2. Register it in `adapters/index.ts`.
3. Nothing in CRM, Vehicles, Knowledge, Inspections, Quotes, Jobs, Parts, or
   Finance changes.
