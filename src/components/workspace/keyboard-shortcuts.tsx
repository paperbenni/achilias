"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Keyboard } from "lucide-react";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const controls = 'a[href], button, input, select, textarea, [tabindex="0"]';
const alphabet = "asdfghjklqwertyuiopzxcvbnm";
type Hint = { element: HTMLElement; label: string; x: number; y: number };

// Native focus keeps Tab, Enter, screen readers and Next Links working normally.
function targets(visibleOnly = true) {
  return Array.from(document.querySelectorAll<HTMLElement>(controls)).filter((el) => {
    const rect = el.getBoundingClientRect();
    return el.tabIndex >= 0 && !el.matches(":disabled, [aria-disabled=true]") &&
      !el.closest('[inert], [aria-hidden=true]') &&
      getComputedStyle(el).visibility !== "hidden" &&
      rect.width > 0 && rect.height > 0 &&
      (!visibleOnly || (rect.bottom > 0 && rect.top < innerHeight)) && rect.right > 0 && rect.left < innerWidth;
  });
}

function moveFocus(key: string) {
  // Treat a resource as one spatial destination. Secondary actions retain
  // their normal Tab order and hint labels.
  const elements = targets(false).filter((el) => {
    const resource = el.closest(".course-card, .resource-row");
    const primary = resource?.querySelector(".resource-primary:not([aria-disabled=true])");
    return !primary || el === primary;
  });
  const current = document.activeElement;
  if (!(current instanceof HTMLElement) || !targets(false).includes(current)) {
    (elements.find((el) => el.closest("main")) || elements[0])?.focus();
    return;
  }
  function bounds(el: HTMLElement) {
    return (el.closest(".course-card, .resource-row") || el).getBoundingClientRect();
  }
  const from = bounds(current);
  const horizontal = key === "h" || key === "l";
  const sign = key === "h" || key === "k" ? -1 : 1;
  let best: HTMLElement | undefined;
  let score = Infinity;
  for (const el of elements) {
    if (el === current) continue;
    const to = bounds(el);
    const dx = (to.left + to.right - from.left - from.right) / 2;
    const dy = (to.top + to.bottom - from.top - from.bottom) / 2;
    const forward = (horizontal ? dx : dy) * sign;
    const sideways = Math.abs(horizontal ? dy : dx);
    const distance = forward + sideways * 3;
    if (forward > 4 && distance < score) {
      best = el;
      score = distance;
    }
  }
  best?.focus({ preventScroll: true });
  best?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

const preferenceKey = "achilias:vim-shortcuts";
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
  const [hints, setHints] = useState<Hint[]>([]);
  const [prefix, setPrefix] = useState("");


  useEffect(() => {
    function dismiss() { setHints([]); setPrefix(""); }
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
      // Let Radix/cmdk own their focus, typeahead and Escape handling.
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], video, audio')) return;
      if (!enabled) return;
      if (hints.length) {
        event.preventDefault();
        if (event.key === "Escape") { dismiss(); return; }
        if (!/^[a-z]$/.test(event.key)) return;
        const next = prefix + event.key;
        const matches = hints.filter((hint) => hint.label.startsWith(next));
        const match = matches.find((hint) => hint.label === next);
        if (match) {
          dismiss();
          if (match.element.isConnected) {
            match.element.focus();
            match.element.click();
          }
        } else if (matches.length) setPrefix(next);
        else dismiss();
        return;
      }
      if (event.key === "?") { event.preventDefault(); setHelpOpen(true); }
      else if (event.key === "/") { event.preventDefault(); openSearch(); }
      else if ("hjkl".includes(event.key) && event.key.length === 1) {
        event.preventDefault();
        moveFocus(event.key);
      } else if (event.key === "f" && !event.repeat) {
        event.preventDefault();
        const elements = targets();
        const width = Math.max(1, Math.ceil(Math.log(elements.length || 1) / Math.log(alphabet.length)));
        setPrefix("");
        setHints(elements.map((element, index) => {
          let label = "";
          for (let n = 0; n < width; n++) {
            label = alphabet[index % alphabet.length] + label;
            index = Math.floor(index / alphabet.length);
          }
          const rect = element.getBoundingClientRect();
          return { element, label, x: Math.max(0, rect.left), y: Math.max(0, rect.top) };
        }));
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    window.addEventListener("pointerdown", dismiss);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("pointerdown", dismiss);
    };
  }, [enabled, hints, prefix, openSearch]);

  return (
    <>
      <SidebarMenuButton onClick={() => setHelpOpen(true)} aria-keyshortcuts="?">
        <Keyboard /><span>Keyboard shortcuts</span><kbd className="ml-auto text-xs">?</kbd>
      </SidebarMenuButton>
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>Vim-style shortcuts work outside text fields, menus and dialogs.</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 text-sm">
            {[
              ["h j k l", "Move focus left, down, up, right"],
              ["Tab / Shift Tab", "Reach every control, including bookmarks"],
              ["Enter / Space", "Activate the focused link / button"],
              ["/", "Open quick search"],
              ["Ctrl / ⌘ K", "Open quick search (always available)"],
              ["f", "Show hints; type a label to activate a control"],
              ["Esc", "Cancel hints or close a popup"],
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
      {hints.length > 0 && createPortal(
        <div className="pointer-events-none fixed inset-0 z-[60]" aria-hidden="true">
          {hints.filter((hint) => hint.label.startsWith(prefix)).map((hint) => (
            <kbd key={hint.label} style={{ left: hint.x, top: hint.y }}
              className="absolute rounded border border-foreground/30 bg-amber-200 px-1 font-mono text-xs font-bold text-black shadow-sm">
              {hint.label}
            </kbd>
          ))}
          <div role="status" className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded bg-popover px-3 py-2 text-sm text-popover-foreground shadow">
            Type a hint to activate · Esc to cancel
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
