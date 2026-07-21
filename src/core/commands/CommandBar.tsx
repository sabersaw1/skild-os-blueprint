// Command Bar overlay. Opens with Cmd/Ctrl+K.
// Purely a host for whatever commands modules have registered.

import { useEffect } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { createStore } from "../store";
import { useCommands } from "./registry";
import { emit } from "../activity/emitter";

const openStore = createStore<boolean>(false);

export function openCommandBar() {
  openStore.set(true);
}
export function closeCommandBar() {
  openStore.set(false);
}
export function useCommandBarOpen() {
  return openStore.use();
}

export function CommandBar() {
  const open = useCommandBarOpen();
  const commands = useCommands();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openStore.set((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const groups = new Map<string, typeof commands>();
  for (const cmd of commands) {
    const key = cmd.group ?? "General";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(cmd);
  }

  return (
    <CommandDialog open={open} onOpenChange={(v) => openStore.set(v)}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        {[...groups.entries()].map(([group, items], idx) => (
          <div key={group}>
            {idx > 0 && <CommandSeparator />}
            <CommandGroup heading={group}>
              {items.map((cmd) => (
                <CommandItem
                  key={cmd.id}
                  value={`${cmd.label} ${cmd.keywords?.join(" ") ?? ""}`}
                  onSelect={() => {
                    closeCommandBar();
                    emit({
                      type: "command.run",
                      moduleId: "commands",
                      summary: `Ran command: ${cmd.label}`,
                      payload: { commandId: cmd.id },
                    });
                    void cmd.run();
                  }}
                >
                  {cmd.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
