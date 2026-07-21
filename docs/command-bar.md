# Command Bar

The Command Bar is the keyboard-first entry point to Skild OS. It's rendered globally by `AppShell` and toggled with `⌘K` / `Ctrl K`.

## Registering a command

```ts
import { registerCommand } from "@/core/commands/registry";

registerCommand({
  id: "customers.new",
  label: "New customer",
  group: "Create",
  keywords: ["add", "customer"],
  requiredCapabilityIds: ["customers.write"],
  run: () => window.location.assign("/customers/new"),
});
```

## Behavior

- `id` must be unique; re-registering with the same id overwrites.
- Commands the current identity lacks capability for are filtered out at query time.
- Selecting a command closes the bar and emits an `activity` event of type `command.run`.
- `group` becomes the section heading. Commands with no group land in "General".
- `keywords` extend fuzzy matching (used by `cmdk`).

## Keyboard

- `⌘K` / `Ctrl K` toggles the bar from anywhere.
- Arrow keys and `Enter` navigate/select (built into `cmdk`).
- `Escape` closes.

## Future

- AI actions register as commands prefixed with `ai.*` and always route through the approval queue when they touch money, pricing, or communications.
