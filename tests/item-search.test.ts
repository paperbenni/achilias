import { expect, test } from "bun:test";
import { matchesItem, rankByTitle, searchTerms } from "../src/lib/ilias/item-search";
import { demoCourses, demoPage } from "../src/lib/ilias/demo";
import { mergeItems } from "../src/lib/ilias/library";

test("an unvisited course is searchable from another course without browser history", () => {
  const items = mergeItems(demoPage("crs", "101").items, demoCourses);
  const found = items.filter((item) => matchesItem(item, searchTerms("linear")));
  expect(found.map((item) => item.id)).toEqual(["102"]);
});

test("local search ignores accents, punctuation, case, and term order", () => {
  const course = { ...demoCourses[0], title: "Übungen: Mensch–Computer", context: "Mathematik › Gruppe 02" };
  for (const query of ["UBUNGEN", "mensch computer", "computer mensch", "mathematik gruppe 02"]) {
    expect(matchesItem(course, searchTerms(query))).toBe(true);
  }
  expect(matchesItem(course, searchTerms("computer physics"))).toBe(false);
  expect(searchTerms("  --  ")).toEqual([]);
});

test("title relevance beats incidental description matches", () => {
  const item = demoCourses[0];
  const titles = [
    { ...item, title: "A course", description: "Linear algebra" },
    { ...item, title: "Advanced Linear Algebra" },
    { ...item, title: "Linear Algebra II" },
    { ...item, title: "Linear Algebra" },
    { ...item, title: "Algebra and linear systems" },
  ];
  expect(rankByTitle(titles, "linear algebra").map((item) => item.title)).toEqual([
    "Linear Algebra", "Linear Algebra II", "Advanced Linear Algebra",
    "Algebra and linear systems", "A course",
  ]);
});
