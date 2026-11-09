"use client";

import { useEffect } from "react";

// Share only shortcut eligibility. Each feature owns its keys and destinations.
export const shortcutPreferenceKey = "achilias:vim-shortcuts";

export function usePageShortcuts(handleKey: (event: KeyboardEvent) => void) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey ||
        localStorage.getItem(shortcutPreferenceKey) === "off") return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')) return;
      if (event.target instanceof HTMLElement && event.target.closest(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], video, audio',
      )) return;
      handleKey(event);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleKey]);
}
