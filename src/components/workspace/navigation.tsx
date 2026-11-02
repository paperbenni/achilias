"use client";
import { AppearanceMenu } from "@/components/navigation/appearance-menu";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ChevronDown,
  CircleHelp,
  LogOut,
  Search,
  Settings2,
  Palette,
  ShieldCheck,
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
import { demoHref, workspaceNav, type WorkspaceViewName } from "./nav-items";

export type { WorkspaceViewName };
function Brand({ demo = false }: { demo?: boolean }) {
  return (
    <Link
      prefetch={demo}
      href={demo ? "/?demo=1" : "/"}
      className="flex items-center gap-2.5"
      aria-label="Achilias home"
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="size-6"
        >
          <path
            d="M4 18 11.5 5 19 18M7 13h9M16 5l4 7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="text-xl font-semibold tracking-tight">
        achilias<span className="text-primary">.</span>
      </span>
    </Link>
  );
}
export function Navigation({
  data,
  view,
  openSearch,
  connect,
}: {
  data: Workspace;
  view: WorkspaceViewName;
  openSearch: () => void;
  connect: () => void;
}) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const demo = data.mode === "demo";
  return (
    <Sidebar collapsible="offcanvas" role="navigation" aria-label="Workspace">
      <SidebarHeader className="px-5 pt-7 pb-6">
        <Brand demo={data.mode === "demo"} />
        <div className="mt-5 flex items-center gap-2.5 rounded-lg border bg-background px-3 py-3">
          <University className="size-4 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{data.instanceName}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {data.mode === "live"
                ? "Your connected campus"
                : data.mode === "demo"
                  ? "Demo workspace"
                  : "Your campus, reimagined"}
            </p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={openSearch}>
                  <Search />
                  <span>Quick search</span>
                  <kbd className="ml-auto text-[10px] text-muted-foreground">
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
        {data.mode === "disconnected" ? (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="justify-start">
                  <Palette />
                  Appearance
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start">
                <AppearanceMenu />
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={connect}>
              <ShieldCheck data-icon="inline-start" />
              Connect account
            </Button>
          </>
        ) : (
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
                      : (data.userName || "You").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="flex flex-1 flex-col items-start">
                  <span>{data.userName || "Your account"}</span>
                  <span className="text-xs text-muted-foreground">
                    {data.mode === "demo"
                      ? "Exploring the demo"
                      : "Connected to ILIAS"}
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
                  onSelect={() => router.push(demoHref("/settings", demo))}
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
                        toast.error("Could not disconnect. Please try again.");
                        return;
                      }
                    }
                    // Drop all prefetched/visited content at an account boundary.
                    window.location.replace("/");
                  }}
                >
                  <LogOut />
                  {data.mode === "demo" ? "Leave demo" : "Disconnect account"}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
