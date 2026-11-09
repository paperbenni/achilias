import { fileControllerReference } from "./file-reference";
import type { Item } from "./types";

// Add object support here so routing and capability badges agree everywhere.
const objectTypes: Record<
  string,
  {
    name: string;
    kind: "container" | "file" | "forum" | "exercise" | "external";
  }
> = {
  crs: { name: "Course", kind: "container" },
  grp: { name: "Group", kind: "container" },
  fold: { name: "Folder", kind: "container" },
  cat: { name: "Category", kind: "container" },
  file: { name: "File", kind: "file" },
  exc: { name: "Exercise", kind: "exercise" },
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
/** Categories and folders are opened for previews; courses and groups can
 * record access state or have much heavier pages, so leave them untouched. */
export function isPreviewableContainer(type: string) {
  return type === "cat" || type === "fold";
}
export function isNavigableItem(item: Item) {
  return (
    item.available &&
    (isContainerType(item.type) ||
      ["forum", "exercise"].includes(objectTypes[item.type]?.kind))
  );
}
/** Only prefetch native pages whose upstream GET is suitable for speculation.
 * Live forum reads can change read state; files and external links aren't routes. */
export function canPrefetchItem(item: Item, demo = false) {
  return isNavigableItem(item) && (demo || isContainerType(item.type) || item.type === "exc");
}
/** Web links leave Achilias and open at their original destination. */
export function isExternalItem(item: Item) {
  return item.available && item.type === "webr";
}
/** The native route for an ILIAS object, when Achilias can open it. */
export function objectHref(type: string, id: string, demo = false) {
  const suffix = demo ? "?demo=1" : "";
  const normalized = type.toLowerCase();
  switch (objectTypes[normalized]?.kind) {
    case "exercise":
      return `/exercises/${id}${suffix}`;
    case "forum":
      return `/forums/${id}${suffix}`;
    case "container":
      return `/browse/${normalized}/${id}${suffix}`;
    case "file":
      return `/api/files/${id}${suffix}`;
    default:
      return undefined;
  }
}
export function itemHref(item: Item, demo = false) {
  return objectHref(item.type, item.id, demo) ?? item.sourceUrl;
}

/** File titles open the browser viewer; explicit download actions use itemHref. */
export function itemOpenHref(item: Item, demo = false) {
  const href = itemHref(item, demo);
  return item.type === "file" ? `${href}${demo ? "&" : "?"}view=1` : href;
}
export function isFileItem(item: Item) {
  return item.available && item.type === "file";
}

/** Repair legacy icon-based classifications, including saved and recent items. */
export function normalizeItemType(item: Item): Item {
  if (item.type !== "unknown" && objectTypes[item.type]) return item;
  return fileControllerReference(item.sourceUrl) === item.id
    ? { ...item, type: "file" }
    : item;
}
