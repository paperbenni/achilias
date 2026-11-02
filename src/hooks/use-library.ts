"use client";
import { toast } from "sonner";
import type { Item, Workspace } from "@/lib/ilias/types";
import { itemKey } from "@/lib/ilias/items";
import {
  decodeLibrary,
  emptyLibrary,
  recordVisit,
  toggleSaved,
  type Library,
} from "@/lib/ilias/library";
import { useBrowserStore } from "./use-browser-store";

export function useLibrary(workspace: Workspace) {
  const key = `achilias:${workspace.storageKey || workspace.mode}:v1`;
  const { value, ready, update } = useBrowserStore(
    key,
    "localStorage",
    decodeLibrary,
    emptyLibrary,
  );
  function change(operation: (library: Library) => Library) {
    if (!update(operation))
      toast.error("Your browser could not save this change.");
  }
  return {
    library: value,
    ready,
    remember(item: Item) {
      change((current) => recordVisit(current, item));
    },
    toggleSave(item: Item) {
      let existed = false;
      change((current) => {
        existed = current.saved.some(
          (saved) => itemKey(saved) === itemKey(item),
        );
        return toggleSaved(current, item);
      });
      toast.success(existed ? "Removed from saved items" : "Saved for later");
    },
    clear() {
      change(() => emptyLibrary);
    },
  };
}
