"use client";
import { KeyboardShortcuts } from "./keyboard-shortcuts";
import { AppearanceMenu } from "@/components/navigation/appearance-menu";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ChevronDown,
  CircleHelp,
  LogOut,
  Search,
  Settings2,
  University,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { Separator } from "@/components/ui/separator";

import type { Workspace } from "@/lib/ilias/types";
import {
  demoHref,
  viewForPathname,
  workspaceNav,
  type WorkspaceViewName,
} from "./nav-items";
import { Brand } from "./brand";

export type { WorkspaceViewName };
export function Navigation({
  data,
  openSearch,
}: {
  data: Workspace;
  openSearch: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const view = viewForPathname(pathname);
  const { setOpenMobile } = useSidebar();
  const demo = data.mode === "demo";
  return (
    <Sidebar collapsible="offcanvas" role="navigation" aria-label="Workspace">
      <SidebarHeader className="px-5 pt-7 pb-6">
        <div className="flex items-center justify-between gap-3">
          <Brand demo={data.mode === "demo"} />
          <SidebarTrigger className="md:hidden" aria-label="Close navigation" />
        </div>
        <div className="mt-5 flex items-center gap-2.5 rounded-lg border bg-background px-3 py-3">
          <University className="size-4 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{data.instanceName}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {data.mode === "live"
                ? "Signed in"
                : data.mode === "demo"
                  ? "Demo workspace"
                  : "Not signed in"}
            </p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => {
                    setOpenMobile(false);
                    openSearch();
                  }}
                >
                  <Search />
                  <span>Quick search</span>
                  <kbd className="ml-auto hidden text-[10px] text-muted-foreground md:inline">
                    ⌘ K
                  </kbd>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>WORKSPACE</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {workspaceNav.map((nav) => (
                <SidebarMenuItem key={nav.title}>
                  <SidebarMenuButton
                    isActive={nav.activeViews.includes(view)}
                    asChild
                  >
                    <Link
                      prefetch={data.mode === "demo" || nav.href === "/saved"}
                      href={demoHref(nav.href, demo)}
                      onClick={() => setOpenMobile(false)}
                    >
                      <nav.icon />
                      <span>{nav.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="mt-auto">
          <SidebarMenu>
            <SidebarMenuItem>
              <KeyboardShortcuts openSearch={openSearch} />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link
                  prefetch={true}
                  href={demoHref("/settings", demo)}
                  onClick={() => setOpenMobile(false)}
                >
                  <CircleHelp />
                  <span>Features & connection</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <a
                  href={data.instance}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ArrowUpRight />
                  <span>Original ILIAS</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <Separator className="mb-2" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-auto justify-start gap-3 py-2"
            >
              <Avatar className="size-8">
                <AvatarFallback>
                  {data.mode === "demo"
                    ? "AL"
                    : (data.userName || "Account").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="flex flex-1 flex-col items-start">
                <span>{data.userName || "Account"}</span>
                <span className="text-xs text-muted-foreground">
                  {data.mode === "demo"
                    ? "Exploring the demo"
                    : "Signed in to ILIAS"}
                </span>
              </span>
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start">
            <AppearanceMenu />
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onSelect={() => {
                  setOpenMobile(false);
                  router.push(demoHref("/settings", demo));
                }}
              >
                <Settings2 />
                Connection settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={async () => {
                  if (data.mode === "live") {
                    const response = await fetch("/api/session", {
                      method: "DELETE",
                    });
                    if (!response.ok) {
                      toast.error("Could not log out. Please try again.");
                      return;
                    }
                  }
                  // Drop all prefetched/visited content at an account boundary.
                  window.location.replace("/");
                }}
              >
                <LogOut />
                {data.mode === "demo" ? "Leave demo" : "Log out"}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
