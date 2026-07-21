import { Link, useRouterState } from "@tanstack/react-router";
import * as Icons from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useNavEntries } from "@/core/modules/registry";

type LucideIcon = typeof Icons.LayoutDashboard;

function resolveIcon(name?: string): LucideIcon {
  if (!name) return Icons.Circle;
  const map = Icons as unknown as Record<string, LucideIcon>;
  return map[name] ?? Icons.Circle;
}

export function AppSidebar() {
  const entries = useNavEntries();
  const currentPath = useRouterState({
    select: (r) => r.location.pathname,
  });

  const isActive = (route: string) =>
    route === "/"
      ? currentPath === "/"
      : currentPath === route || currentPath.startsWith(route + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-3">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs">
            S
          </span>
          <span className="text-sm">Skild OS</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {entries.map((e) => {
                const Icon = resolveIcon(e.icon);
                return (
                  <SidebarMenuItem key={e.id}>
                    <SidebarMenuButton asChild isActive={isActive(e.route)}>
                      <Link to={e.route}>
                        <Icon className="h-4 w-4" />
                        <span>{e.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
