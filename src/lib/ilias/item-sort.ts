import { itemKey } from "./items";
import type { Item } from "./types";
import type { Library } from "./library";

export type ItemVisit = { count: number; lastOpened: number; score: number };
export type ItemVisits = Record<string, ItemVisit>;
const week = 7 * 24 * 60 * 60 * 1000;
const decay = (score: number, elapsed: number) => score * 2 ** (-Math.max(0, elapsed) / week);

export const itemSortOptions = [
  ["frecency", "Frecency"],
  ["recent", "Recently opened"],
  ["frequent", "Most opened"],
  ["name", "Name A–Z"],
  ["name-desc", "Name Z–A"],
  ["saved", "Bookmarks first"],
  ["source", "ILIAS order"],
] as const;
export type ItemSort = typeof itemSortOptions[number][0];
export function decodeItemSort(value: unknown, fallback: ItemSort = "frecency"): ItemSort {
  return itemSortOptions.some(([key]) => key === value) ? value as ItemSort : fallback;
}

export function decodeItemVisits(value: unknown): ItemVisits {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, entry]) =>
    /^[a-z]{2,8}:[1-9]\d{0,11}$/.test(key) && entry && typeof entry === "object" &&
    Number.isSafeInteger(entry.count) && entry.count > 0 &&
    Number.isFinite(entry.lastOpened) && entry.lastOpened > 0 &&
    Number.isFinite(entry.score) && entry.score > 0,
  ).sort((a, b) => b[1].lastOpened - a[1].lastOpened).slice(0, 512));
}

export function recordItemVisit(visits: ItemVisits, item: Item, now: number): ItemVisits {
  const key = itemKey(item);
  const old = visits[key];
  return decodeItemVisits({
    ...visits,
    [key]: {
      count: Math.min(Number.MAX_SAFE_INTEGER, (old?.count || 0) + 1),
      lastOpened: now,
      score: 1 + (old ? decay(old.score, now - old.lastOpened) : 0),
    },
  });
}

/** Stable ties preserve upstream order. Usage reflects item opens in this browser,
 * not prefetches or activity reported by ILIAS. Scores halve each week.
 */
export function sortItems(items: Item[], sort: ItemSort, library: Library, now = Date.now()): Item[] {
  const visits = library.itemVisits || {};
  const saved = new Set(library.saved.map(itemKey));
  const recent = new Map(library.recent.map((item, index) => [itemKey(item), library.recent.length - index]));
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  function score(item: Item) {
    const key = itemKey(item);
    const visit = visits[key];
    switch (sort) {
      case "frecency": return visit ? decay(visit.score, now - visit.lastOpened) : 0;
      case "frequent": return visit?.count || 0;
      case "recent": return visit?.lastOpened || recent.get(key) || 0;
      case "saved": return Number(saved.has(key));
      default: return 0;
    }
  }
  return [...items].sort((a, b) => {
    if (sort === "name" || sort === "name-desc")
      return collator.compare(a.title, b.title) * (sort === "name" ? 1 : -1);
    return score(b) - score(a);
  });
}
