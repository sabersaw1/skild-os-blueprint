import { type ReactNode, useEffect } from "react";
import { Search } from "lucide-react";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "./app-sidebar";
import { MobileNav } from "./mobile-nav";
import { StatusIndicator } from "./status-indicator";
import { CommandBar, openCommandBar } from "@/core/commands/CommandBar";
import { useIdentity } from "@/core/auth/identity";
import { bootstrapPhase1 } from "@/core/bootstrap";
import { useRouterState } from "@tanstack/react-router";
import { emit } from "@/core/activity/emitter";

// Kick off registrations once. Safe on both SSR and CSR because
// bootstrapPhase1 is idempotent.
bootstrapPhase1();

export function AppShell({ children }: { children: ReactNode }) {
  const identity = useIdentity();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  useEffect(() => {
    emit({
      type: "navigation",
      moduleId: "shell",
      summary: `Navigated to ${pathname}`,
      payload: { pathname },
    });
  }, [pathname]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <div className="hidden md:block">
          <AppSidebar />
        </div>
        <SidebarInset className="flex flex-col min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur">
            <SidebarTrigger className="hidden md:inline-flex" />
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs text-muted-foreground"
              onClick={openCommandBar}
              aria-label="Open command bar"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Command Bar</span>
              <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono sm:inline">
                ⌘K
              </kbd>
            </Button>
            <StatusIndicator />
            <div
              className="ml-1 flex items-center gap-2 rounded-md border px-2 py-1 text-xs"
              aria-label="Current identity"
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px]">
                {identity.displayName.slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden sm:inline">{identity.displayName}</span>
            </div>
          </header>

          <main className="flex-1 pb-16 md:pb-0">{children}</main>
          <MobileNav />
        </SidebarInset>
      </div>
      <CommandBar />
    </SidebarProvider>
  );
}
