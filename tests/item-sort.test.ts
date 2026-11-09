import { expect, test } from "bun:test";
import { decodeItemSort, sortItems } from "../src/lib/ilias/item-sort";
import { decodeLibrary, emptyLibrary, recordVisit } from "../src/lib/ilias/library";
import type { Item } from "../src/lib/ilias/types";

const day = 86400000;
const now = 100 * day;
const item = (id: string, title = id, type = "crs"): Item => ({
  id, title, type, description: "", meta: "", available: true,
  sourceUrl: "https://ilias.example/goto.php?target=crs_" + id,
});
const ids = (items: Item[]) => items.map((item) => item.id);

test("frecency combines opens and time decay, distinct from frequency and recency", () => {
  const old = item("1"), frequent = item("2"), recent = item("3"), unseen = item("4");
  let library = emptyLibrary;
  for (let i = 0; i < 20; i++) library = recordVisit(library, old, now - 70 * day);
  for (let i = 0; i < 4; i++) library = recordVisit(library, frequent, now - day);
  library = recordVisit(library, recent, now);
  const courses = [unseen, old, recent, frequent];
  expect(ids(sortItems(courses, "frecency", library, now))).toEqual(["2", "3", "1", "4"]);
  expect(ids(sortItems(courses, "recent", library, now))).toEqual(["3", "2", "1", "4"]);
  expect(ids(sortItems(courses, "frequent", library, now))).toEqual(["1", "2", "3", "4"]);
  expect(library.itemVisits?.["crs:2"].score).toBe(4);
  const revisited = recordVisit(library, frequent, now + 6 * day);
  expect(revisited.itemVisits?.["crs:2"].score).toBe(3);
});

test("names sort naturally, bookmarks first keeps stable ties, source order is retained", () => {
  const courses = [item("1", "Course 10"), item("2", "Course 2"), item("3", "Algebra", "grp")];
  const library = { ...emptyLibrary, saved: [courses[2]] };
  expect(ids(sortItems(courses, "name", library))).toEqual(["3", "2", "1"]);
  expect(ids(sortItems(courses, "name-desc", library))).toEqual(["1", "2", "3"]);
  expect(ids(sortItems(courses, "saved", library))).toEqual(["3", "1", "2"]);
  expect(ids(sortItems(courses, "source", library))).toEqual(["1", "2", "3"]);
  expect(ids(courses)).toEqual(["1", "2", "3"]);
  expect(decodeItemSort("malformed")).toBe("frecency");
});

test("legacy libraries retain recency; course stats survive beyond twelve recent items", () => {
  const old = item("1"), newer = item("2");
  const legacy = decodeLibrary({ saved: [], recent: [newer, old] });
  expect(ids(sortItems([old, newer], "recent", legacy))).toEqual(["2", "1"]);
  let library = recordVisit(legacy, old, now);
  for (let i = 10; i < 30; i++) library = recordVisit(library, item(String(i), "", "file"), now);
  expect(library.recent).toHaveLength(12);
  expect(decodeLibrary(JSON.parse(JSON.stringify(library))).itemVisits?.["crs:1"].count).toBe(1);
  expect(Object.keys(library.itemVisits || {})).toHaveLength(21);
  expect(library.itemVisits?.["file:10"].count).toBe(1);
});

test("stored stats reject invalid values and are bounded to the latest 512 items", () => {
  const itemVisits = Object.fromEntries(Array.from({ length: 600 }, (_, i) => [
    "crs:" + (i + 1), { count: 1, lastOpened: i + 1, score: 1 },
  ]));
  Object.assign(itemVisits, {
    "../file:601": { count: 1, lastOpened: now, score: 1 },
    "grp:602": { count: -1, lastOpened: now, score: 1 },
    "crs:603": { count: 1, lastOpened: NaN, score: 1 },
  });
  const library = decodeLibrary({ itemVisits });
  expect(Object.keys(library.itemVisits || {})).toHaveLength(512);
  expect(library.itemVisits?.["crs:1"]).toBeUndefined();
  expect(library.itemVisits?.["crs:600"].count).toBe(1);
  expect(library.itemVisits?.["grp:602"]).toBeUndefined();
});
