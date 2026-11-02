import { itemKey, typeNames } from "./items";
import type { Item } from "./types";

/** Treat accents, punctuation, and whitespace alike in local search. */
function normalizeSearch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Split a query into normalized terms, dropping empties. */
export function searchTerms(query: string) {
  return normalizeSearch(query).split(/\s+/).filter(Boolean);
}

/**
 * The haystack shared by instant palette filtering and repository search:
 * every field that can identify an object, including its repository path,
 * which is what distinguishes identically named groups and folders.
 */
export function matchesItem(item: Item, terms: string[]) {
  const haystack = normalizeSearch(
    [item.title, item.description, item.meta, item.context, item.id, typeNames[item.type]]
      .join(" "),
  );
  return terms.every((term) => haystack.includes(term));
}

/**
 * Rank repository results so matches inside enrolled, saved, or recently
 * visited courses come first. ILIAS ranks globally, so a familiar course's material can
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

/** Exact path segments keep similarly named courses distinguishable. */
export function isInsideCourses(item: Item, courses: Item[]) {
  const path = (item.context || "").split("›").map((part) => normalizeSearch(part));
  return courses.some((course) =>
    (course.type === "crs" || course.type === "grp") &&
    (itemKey(item) === itemKey(course) || path.includes(normalizeSearch(course.title))),
  );
}

/** Title matches before metadata matches; alphabetical within each tier. */
export function rankByTitle(items: Item[], query: string): Item[] {
  const normalized = normalizeSearch(query);
  const terms = searchTerms(query);
  const rank = (item: Item) => {
    const title = normalizeSearch(item.title);
    return title === normalized
      ? 0
      : title.startsWith(normalized)
        ? 1
        : title.includes(normalized)
          ? 2
          : terms.every((term) => title.includes(term))
            ? 3
            : 4;
  };
  return [...items].sort(
    (a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title),
  );
}
