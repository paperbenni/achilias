"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useSearchParams } from "next/navigation";
import { Navigation } from "./navigation";
import { ConnectDialog } from "./connect-dialog";
import { SidebarProvider } from "@/components/ui/sidebar";
import type { Workspace } from "@/lib/ilias/types";

type WorkspaceShellContextValue = {
  searchOpen: boolean;
  setSearchOpen: Dispatch<SetStateAction<boolean>>;
  connectOpen: boolean;
  setConnectOpen: Dispatch<SetStateAction<boolean>>;
};

const WorkspaceShellContext =
  createContext<WorkspaceShellContextValue | null>(null);

export function useWorkspaceShell() {
  const context = useContext(WorkspaceShellContext);
  if (!context) {
    throw new Error("useWorkspaceShell must be used within WorkspaceShell.");
  }
  return context;
}

/**
 * Persistent workspace chrome. It lives in the route-group layout so the
 * sidebar survives page navigation and only the page area shows a loading
 * state.
 */
export function WorkspaceShell({
  live,
  demo,
  children,
}: {
  children: ReactNode;
  demo: Workspace;
  live: Workspace;
}) {
  const searchParams = useSearchParams();
  const data = searchParams.get("demo") === "1" ? demo : live;
  const [searchOpen, setSearchOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const value = useMemo(
    () => ({ searchOpen, setSearchOpen, connectOpen, setConnectOpen }),
    [searchOpen, connectOpen],
  );
  // Signed-out pages are a focused, full-screen sign-in flow. The workspace
  // sidebar and navigation only make sense once there is an account or demo.
  if (data.mode === "disconnected")
    return (
      <WorkspaceShellContext.Provider value={value}>
        {children}
      </WorkspaceShellContext.Provider>
    );
  return (
    <WorkspaceShellContext.Provider value={value}>
      <SidebarProvider>
        <Navigation data={data} openSearch={() => setSearchOpen(true)} />
        {children}
        <ConnectDialog
          key={data.mode}
          open={connectOpen}
          onOpenChange={setConnectOpen}
          instance={data.instance}
        />
      </SidebarProvider>
    </WorkspaceShellContext.Provider>
  );
}
