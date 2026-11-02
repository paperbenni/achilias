import { expect, test } from "bun:test";
import {
  decodeLibrary,
  emptyLibrary,
  mergeItems,
  recordVisit,
  toggleSaved,
} from "../src/lib/ilias/library";
import {
  canPrefetchItem,
  isExternalItem,
  isNavigableItem,
  isSupportedItemType,
  itemHref,
} from "../src/lib/ilias/items";
import { rankByFamiliarity } from "../src/lib/ilias/item-search";
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
test("external web links may use http or https", () => {
  const web = item("6", {
    type: "webr",
    sourceUrl: "http://example.org/register",
  });
  expect(decodeLibrary({ saved: [web], recent: [] }).saved).toEqual([web]);
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
test("repository paths are validated and fill gaps without overriding current metadata", () => {
  const saved = item("9", {
    title: "Saved title",
    context: "Algorithms › Exercise groups",
  });
  expect(decodeLibrary({ saved: [saved], recent: [] }).saved).toEqual([saved]);
  expect(
    decodeLibrary({
      saved: [{ ...saved, context: 42 }],
      recent: [{ ...saved, context: "x".repeat(1001) }],
    }),
  ).toEqual(emptyLibrary);
  const current = item("9", { title: "Current title" });
  expect(mergeItems([current], [saved])).toEqual([
    { ...current, context: saved.context },
  ]);
  expect(mergeItems([current], [{ ...saved, context: undefined }])).toEqual([
    current,
  ]);
});
test("results from saved and recently used courses rank first without reordering the rest", () => {
  const algorithms = item("7", { title: "Algorithms" });
  const linear = item("8", { title: "Linear Algebra I", type: "grp" });
  const results = [
    item("1", { type: "file", context: "Networks › Materials" }),
    item("2", { type: "file", context: "Operating Systems › Materials" }),
    item("3", { type: "file", context: "Linear Algebra I › Materials" }),
    item("4", { type: "file", context: "Algorithms › Materials" }),
    linear,
  ];
  expect(
    rankByFamiliarity(results, [algorithms, linear]).map((entry) => entry.id),
  ).toEqual(["8", "4", "3", "1", "2"]);
  // A saved title that is only part of another path must not match.
  expect(
    rankByFamiliarity(
      [item("5", { type: "file", context: "Linear Algebra II › Materials" })],
      [{ ...linear, id: "9", title: "Linear Algebra" }],
    ).map((entry) => entry.id),
  ).toEqual(["5"]);
  expect(rankByFamiliarity(results, [])).toEqual(results);
});

test("object capability rules agree with navigation while retaining restricted and unsupported objects", () => {
  for (const type of ["crs", "grp", "fold", "cat", "frm", "exc"]) {
    const resource = item("42", { type });
    expect(isSupportedItemType(type)).toBe(true);
    expect(isNavigableItem(resource)).toBe(true);
    expect(isNavigableItem({ ...resource, available: false })).toBe(false);
    expect(itemHref(resource, true)).toContain("?demo=1");
  }
  expect(isSupportedItemType("file")).toBe(true);
  expect(isNavigableItem(item("42", { type: "file" }))).toBe(false);
  expect(
    isExternalItem(
      item("42", {
        type: "webr",
        sourceUrl: "https://example.org/register",
      }),
    ),
  ).toBe(true);
  expect(
    isExternalItem(
      item("42", {
        type: "webr",
        available: false,
        sourceUrl: "https://example.org/register",
      }),
    ),
  ).toBe(false);
  for (const type of ["tst", "custom"]) {
    const resource = item("42", { type });
    expect(isSupportedItemType(type)).toBe(false);
    expect(isNavigableItem(resource)).toBe(false);
    expect(itemHref(resource)).toBe(resource.sourceUrl);
  }
});


test("speculative navigation excludes live forum reads, downloads, unsupported and restricted items", () => {
  expect(canPrefetchItem(item("1", { type: "frm" }))).toBe(false);
  expect(canPrefetchItem(item("1", { type: "frm" }), true)).toBe(true);
  for (const type of ["file", "webr", "unknown", "tst"])
    expect(canPrefetchItem(item("1", { type }), true)).toBe(false);
  expect(canPrefetchItem(item("1", { available: false }))).toBe(false);
  expect(canPrefetchItem(item("1", { type: "exc" }))).toBe(true);
});
