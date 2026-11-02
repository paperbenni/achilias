import type { Item } from "./types";

// Add object support here so routing and capability badges agree everywhere.
const objectTypes: Record<
  string,
  { name: string; kind: "container" | "file" | "forum" | "external" }
> = {
  crs: { name: "Course", kind: "container" },
  grp: { name: "Group", kind: "container" },
  fold: { name: "Folder", kind: "container" },
  cat: { name: "Category", kind: "container" },
  file: { name: "File", kind: "file" },
  exc: { name: "Assignment", kind: "external" },
  tst: { name: "Test", kind: "external" },
  frm: { name: "Forum", kind: "forum" },
  lm: { name: "Learning module", kind: "external" },
  htlm: { name: "HTML module", kind: "external" },
  sahs: { name: "SCORM module", kind: "external" },
  webr: { name: "Web link", kind: "external" },
  wiki: { name: "Wiki", kind: "external" },
  sess: { name: "Session", kind: "external" },
  svy: { name: "Survey", kind: "external" },
  blog: { name: "Blog", kind: "external" },
  mcst: { name: "Media", kind: "external" },
  poll: { name: "Poll", kind: "external" },
  book: { name: "Booking", kind: "external" },
  cwrk: { name: "Course work", kind: "external" },
  unknown: { name: "ILIAS object", kind: "external" },
};
export const typeNames: Record<string, string> = Object.fromEntries(
  Object.entries(objectTypes).map(([type, { name }]) => [type, name]),
);
export function itemKey(item: Item) {
  return `${item.type}:${item.id}`;
}
export function isContainerType(type: string) {
  return objectTypes[type]?.kind === "container";
}
export function isSupportedItemType(type: string) {
  const kind = objectTypes[type]?.kind;
  return !!kind && kind !== "external";
}
export function isNavigableItem(item: Item) {
  return (
    item.available &&
    (isContainerType(item.type) || objectTypes[item.type]?.kind === "forum")
  );
}
export function itemHref(item: Item, demo = false) {
  const suffix = demo ? "?demo=1" : "";
  switch (objectTypes[item.type]?.kind) {
    case "forum":
      return `/forums/${item.id}${suffix}`;
    case "container":
      return `/browse/${item.type}/${item.id}${suffix}`;
    case "file":
      return `/api/files/${item.id}${suffix}`;
    default:
      return item.sourceUrl;
  }
}
