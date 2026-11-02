import { expect, test } from "bun:test";
import {
  decodeLibrary,
  emptyLibrary,
  mergeItems,
  recordVisit,
  toggleSaved,
} from "../src/lib/ilias/library";
import {
  isNavigableItem,
  isSupportedItemType,
  itemHref,
} from "../src/lib/ilias/items";
import type { Item } from "../src/lib/ilias/types";
const item = (id: string, fields: Partial<Item> = {}): Item => ({
  id,
  type: "crs",
  title: "Course",
  description: "",
  meta: "",
  available: true,
  sourceUrl: `https://campus.example/goto.php?target=crs_${id}`,
  ...fields,
});

test("restoring a library discards malformed and unsafe entries, deduplicates, and bounds history", () => {
  const course = item("1");
  const library = decodeLibrary({
    saved: [
      null,
      {},
      course,
      course,
      item("2", { sourceUrl: "javascript:alert(1)" }),
      item("../3"),
      item("4", { sourceUrl: "https://user:pass@campus.example/" }),
    ],
    recent: Array.from({ length: 20 }, (_, index) => item(String(index + 1))),
  });
  expect(library.saved).toEqual([course]);
  expect(library.recent).toHaveLength(12);
  expect(decodeLibrary(null)).toEqual(emptyLibrary);
});
test("current metadata wins over saved copies and resource identity includes object type", () => {
  const current = item("1", { title: "Renamed course", available: false });
  const old = item("1");
  const folder = item("1", { type: "fold" });
  expect(mergeItems([current], [old, folder])).toEqual([current, folder]);
  expect(recordVisit({ saved: [old], recent: [old, folder] }, current)).toEqual(
    { saved: [old], recent: [current, folder] },
  );
  expect(toggleSaved(toggleSaved(emptyLibrary, current), current)).toEqual(
    emptyLibrary,
  );
});
test("object capability rules agree with navigation while retaining restricted and unsupported objects", () => {
  for (const type of ["crs", "grp", "fold", "cat", "frm"]) {
    const resource = item("42", { type });
    expect(isSupportedItemType(type)).toBe(true);
    expect(isNavigableItem(resource)).toBe(true);
    expect(isNavigableItem({ ...resource, available: false })).toBe(false);
    expect(itemHref(resource, true)).toContain("?demo=1");
  }
  expect(isSupportedItemType("file")).toBe(true);
  expect(isNavigableItem(item("42", { type: "file" }))).toBe(false);
  for (const type of ["exc", "tst", "custom"]) {
    const resource = item("42", { type });
    expect(isSupportedItemType(type)).toBe(false);
    expect(isNavigableItem(resource)).toBe(false);
    expect(itemHref(resource)).toBe(resource.sourceUrl);
  }
});
