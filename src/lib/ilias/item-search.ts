import { itemKey, typeNames } from "./items";
import type { Item } from "./types";

/** Split a query into lowercase terms, dropping empties. */
export function searchTerms(query: string) {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * The haystack shared by instant palette filtering and repository search:
 * every field that can identify an object, including its repository path,
 * which is what distinguishes identically named groups and folders.
 */
export function matchesItem(item: Item, terms: string[]) {
  const haystack = [
    item.title,
    item.description,
    item.meta,
    item.context,
    item.id,
    typeNames[item.type],
  ]
    .join(" ")
    .toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

/**
 * Rank repository results so matches inside courses the user saved or recently
 * visited come first. ILIAS ranks globally, so a familiar course's material can
 * otherwise sit below objects the user has never opened. Results outside those
 * courses keep their upstream order.
 */
export function rankByFamiliarity(items: Item[], familiar: Item[]): Item[] {
  const courses = familiar.filter(
    (item) => item.type === "crs" || item.type === "grp",
  );
  if (!courses.length) return items;
  const titles = courses.map((course) => course.title.trim().toLowerCase());
  const keys = new Set(courses.map(itemKey));
  const tier = (item: Item) => {
    if (keys.has(itemKey(item))) return 0;
    const path = (item.context || "")
      .split("›")
      .map((segment) => segment.trim().toLowerCase());
    const index = titles.findIndex((title) => path.includes(title));
    return index < 0 ? titles.length + 1 : index + 1;
  };
  return [...items].sort((a, b) => tier(a) - tier(b));
}

/** Exact titles first, then prefixes, then substrings; ties keep their order. */
export function rankByTitle(items: Item[], query: string): Item[] {
  const normalized = query.trim().toLowerCase();
  const rank = (item: Item) => {
    const title = item.title.toLowerCase();
    return title === normalized
      ? 0
      : title.startsWith(normalized)
        ? 1
        : title.includes(normalized)
          ? 2
          : 3;
  };
  return [...items].sort(
    (a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title),
  );
}
