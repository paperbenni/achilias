import { expect, test } from "bun:test";
import { advanceNavigation, navigationKey, type NavigationTrail } from "../src/lib/navigation-trail";

const overview = { title: "Overview", href: "/" };
const courses = { title: "My courses", href: "/courses" };
const course = { title: "Rechnernetze | WiSe 26/27", href: "/browse/crs/10" };
const semester = { title: "Wintersemester 2026", href: "/browse/cat/20" };
const university = { title: "University", href: "/browse/cat/1" };
const folder = { title: "Materials", href: "/browse/fold/30" };
const fallback = [courses];

test("opening an unvisited semester ancestor cannot put its course above it", () => {
  const current: NavigationTrail = { trail: [overview, course], ancestors: [university, semester], back: overview };
  const result = advanceNavigation(current, semester, [university], fallback);
  expect(result.trail).toEqual([overview, semester]);
  expect(result.back).toEqual(course);
  expect(result.backIsHistory).toBe(true);
  // The source locator also handles an ancestor whose response has no locator.
  expect(advanceNavigation(current, semester, undefined, fallback).trail).toEqual([overview, semester]);
});

test("visited ancestors survive descents without adding unvisited repository nodes", () => {
  const result = advanceNavigation({ trail: [courses, course] }, folder, [university, semester, course], fallback);
  expect(result.trail).toEqual([courses, course, folder]);
  expect(result.back).toEqual(course);
});

test("moving across courses drops the unrelated course but preserves the actual back destination", () => {
  const other = { title: "Other course", href: "/browse/crs/40" };
  const result = advanceNavigation({ trail: [overview, course, folder] }, other, [university, semester], fallback);
  expect(result.trail).toEqual([overview, other]);
  expect(result.back).toEqual(folder);
});

test("a restored polluted breadcrumb is repaired on reload", () => {
  const result = advanceNavigation({ trail: [overview, course, semester], back: course }, semester, [university], fallback);
  expect(result.trail).toEqual([overview, semester]);
  expect(result.back).toEqual(course);
});

test("sorting and pagination update a node instead of adding breadcrumb levels", () => {
  const thread = { title: "Discussion", href: "/forums/1/threads/2?demo=1" };
  const sorted = { ...thread, href: "/forums/1/threads/2?order=newest&demo=1&page=2" };
  const result = advanceNavigation({ trail: [courses, thread], back: courses }, sorted, [], fallback);
  expect(result.trail).toEqual([courses, sorted]);
  expect(result.back).toEqual(thread);
  expect(navigationKey(thread.href)).toBe(navigationKey(sorted.href));
  const legacy = advanceNavigation({ trail: [courses, thread, sorted], back: thread }, sorted, [], fallback);
  expect(legacy.trail).toEqual([courses, sorted]);
  expect(legacy.back).toEqual(thread);
});

test("direct links have a safe entry point and sidebar destinations reset the path", () => {
  const direct = advanceNavigation({ trail: [] }, folder, [university, semester, course], fallback);
  expect(direct.trail).toEqual([courses, folder]);
  expect(direct.back).toEqual(courses);
  expect(direct.backIsHistory).toBe(false);
  expect(advanceNavigation(direct, overview, undefined, fallback).trail).toEqual([overview]);
});

test("resource identity, not duplicate titles, determines ancestry", () => {
  const unrelated = { ...course, href: "/browse/crs/99" };
  const result = advanceNavigation({ trail: [courses, unrelated] }, folder, [course], fallback);
  expect(result.trail).toEqual([courses, folder]);
});

test("known hierarchy order repairs reversed historical ancestors", () => {
  const result = advanceNavigation({ trail: [overview, course, semester] }, folder, [semester, course], fallback);
  expect(result.trail).toEqual([overview, course, folder]);
});

test("unknown hierarchy preserves actual visits rather than guessing a repository path", () => {
  const result = advanceNavigation({ trail: [overview, course] }, folder, undefined, fallback);
  expect(result.trail).toEqual([overview, course, folder]);
});
