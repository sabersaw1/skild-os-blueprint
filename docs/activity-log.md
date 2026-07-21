# Activity Log

Every state-changing UI action in Skild OS emits an `ActivityEvent`. This is the audit substrate.

## Emitting

```ts
import { emit } from "@/core/activity/emitter";

emit({
  type: "customers.updated",
  moduleId: "customers",
  summary: `Updated customer ${customer.name}`,
  payload: { customerId: customer.id, fields: ["email"] },
});
```

`actorId` is auto-filled from the current identity.

## Rules

- Emit for every write, every command execution, every settings change, and every navigation.
- `type` uses `<module>.<verb>` convention (e.g. `customers.created`, `job.status.changed`). Shell events use `navigation`, `settings.change`, `command.run`.
- `summary` is human-readable, one line. Put structured detail in `payload`.
- Do not include secrets or PII beyond what the summary already reveals to an authorized viewer.

## Phase 1 behavior

- Sink is an in-memory ring buffer capped at 500 events.
- Cleared on page refresh. This is intentional — persistent audit lands with the data layer.
- The `/activity` page renders the buffer with filter + search.

## Migration path

When a persistent audit store lands, only the sink inside `core/activity/emitter.ts` changes. The `emit()` API is stable.
