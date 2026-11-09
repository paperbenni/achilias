"use client";

import { useState, useSyncExternalStore } from "react";
import { Keyboard } from "lucide-react";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

import { shortcutPreferenceKey as preferenceKey, usePageShortcuts } from "@/hooks/use-page-shortcuts";

function subscribePreference(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}
function readPreference() {
  return localStorage.getItem(preferenceKey) !== "off";
}

export function KeyboardShortcuts({ openSearch }: { openSearch: () => void }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const enabled = useSyncExternalStore(subscribePreference, readPreference, () => true);
  usePageShortcuts((event) => {
    if (event.key === "?") { event.preventDefault(); setHelpOpen(true); }
    else if (event.key === "/") { event.preventDefault(); openSearch(); }
  });

  return (
    <>
      <SidebarMenuButton onClick={() => setHelpOpen(true)} aria-keyshortcuts="?">
        <Keyboard /><span>Keyboard shortcuts</span><kbd className="ml-auto text-xs">?</kbd>
      </SidebarMenuButton>
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>Shortcuts follow the current page and work outside text fields, menus and dialogs.</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 text-sm">
            {[
              ["h j k l", "Resources: select a card or row in that direction"],
              ["j / k", "Forums: next / previous discussion or post"],
              ["Tab / Shift Tab", "Reach every control, including bookmarks"],
              ["Enter / Space", "Activate the focused link / button"],
              ["/", "Open quick search"],
              ["Ctrl / ⌘ K", "Open quick search (always available)"],
              ["Esc", "Close a popup"],
              ["?", "Show this help"],
              ["Ctrl / ⌘ B", "Toggle sidebar"],
            ].map(([keys, description]) => (
              <div key={keys} className="contents"><dt><kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">{keys}</kbd></dt><dd>{description}</dd></div>
            ))}
          </dl>
          <label className="flex items-center gap-2 border-t pt-3 text-sm">
            <input type="checkbox" checked={enabled} onChange={(event) => {
              localStorage.setItem(preferenceKey, event.target.checked ? "on" : "off");
              window.dispatchEvent(new Event("storage"));
            }} />
            Enable single-key shortcuts
          </label>
        </DialogContent>
      </Dialog>
    </>
  );
}
