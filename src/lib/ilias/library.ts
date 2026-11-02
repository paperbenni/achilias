import type { Item } from "./types";
import { itemKey } from "./items";
import { validObjectId } from "./identifiers";

export type Library = { saved: Item[]; recent: Item[] };
export const emptyLibrary: Library = { saved: [], recent: [] };
function validItem(value: unknown): value is Item {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== "string" ||
    !validObjectId(item.id) ||
    typeof item.type !== "string" ||
    !/^[a-z]{2,8}$/.test(item.type) ||
    typeof item.available !== "boolean" ||
    ![item.title, item.description, item.meta, item.sourceUrl].every(
      (v) => typeof v === "string",
    ) ||
    (item.context !== undefined &&
      (typeof item.context !== "string" || item.context.length > 1000))
  )
    return false;
  try {
    const url = new URL(item.sourceUrl as string);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
/** First source wins: current server metadata must take precedence over saved copies. */
export function mergeItems(...sources: Item[][]): Item[] {
  const items = new Map<string, Item>();
  for (const source of sources)
    for (const item of source) {
      const key = itemKey(item);
      const current = items.get(key);
      if (!current) items.set(key, item);
      // A saved copy may know the repository path even when the current page
      // only exposes the object itself. Keep the first source's metadata.
      else if (!current.context && item.context)
        items.set(key, { ...current, context: item.context });
    }
  return [...items.values()];
}
export function decodeLibrary(value: unknown): Library {
  if (!value || typeof value !== "object") return emptyLibrary;
  const { saved, recent } = value as Record<string, unknown>;
  return {
    saved: Array.isArray(saved) ? mergeItems(saved.filter(validItem)) : [],
    recent: Array.isArray(recent)
      ? mergeItems(recent.filter(validItem)).slice(0, 12)
      : [],
  };
}
export function toggleSaved(library: Library, item: Item): Library {
  const exists = library.saved.some(
    (saved) => itemKey(saved) === itemKey(item),
  );
  return {
    ...library,
    saved: exists
      ? library.saved.filter((saved) => itemKey(saved) !== itemKey(item))
      : [...library.saved, item],
  };
}
export function recordVisit(library: Library, item: Item): Library {
  return {
    ...library,
    recent: mergeItems([item], library.recent).slice(0, 12),
  };
}
