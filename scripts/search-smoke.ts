import { chromium } from "playwright";
import assert from "node:assert/strict";
import { demoCourses } from "../src/lib/ilias/demo";

const origin = process.env.ACHILIAS_TEST_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let releaseCatalog!: () => void;
  const catalogReady = new Promise<void>((resolve) => { releaseCatalog = resolve; });
  await page.route("**/api/search/items?demo=1", async (route) => {
    await catalogReady;
    await route.continue();
  });
  // A fresh browser on a nested route has never visited or bookmarked Algebra.
  await page.goto(`${origin}/browse/crs/101?demo=1`);
  await page.getByRole("button", { name: "Quick search", exact: true }).click();
  await page.getByRole("combobox").fill("linear");
  await page.getByRole("status").filter({ hasText: "Loading your courses" }).waitFor();
  assert.equal(await page.getByText(/No matches/).count(), 0);
  releaseCatalog();
  await page.getByRole("option", { name: /Linear Algebra I/ }).waitFor();
  await page.unroute("**/api/search/items?demo=1");
  assert.equal(await page.getByRole("option", { name: /Linear Algebra I/ }).count(), 1);
  await page.getByRole("option", { name: /Linear Algebra I/ }).click();
  await page.getByRole("heading", { name: "Linear Algebra I", exact: true }).waitFor();

  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill("gruppe");
  await page.getByText("Introduction to Computer Science › Exercise groups").waitFor();
  assert.equal(await page.getByRole("option", { name: /Gruppe 02/ }).count(), 3);
  // Nested materials arrive automatically, first within this course, then
  // across other courses, without opening a folder or selecting a search action.
  const searchedRoots: (string | null)[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/search" && url.searchParams.get("q") === "getting started")
      searchedRoots.push(url.searchParams.get("root"));
  });
  await page.getByRole("combobox").fill("getting started");
  await page.getByRole("option", { name: /Getting started.pdf/ }).first().waitFor();
  await page.getByText("Introduction to Computer Science › Lecture materials", { exact: true }).waitFor();
  assert.equal(await page.getByRole("option", { name: /Getting started.pdf/ }).count(), 4);
  assert.deepEqual(searchedRoots, ["102", null]);
  // A late response for an abandoned query must not replace newer matches.
  let releaseOld!: () => void;
  let markOldStarted!: () => void;
  const oldStarted = new Promise<void>((resolve) => { markOldStarted = resolve; });
  const oldReleased = new Promise<void>((resolve) => { releaseOld = resolve; });
  await page.route("**/api/search?*", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q");
    if (query !== "oldneedle" && query !== "newneedle") return route.continue();
    if (query === "oldneedle") { markOldStarted(); await oldReleased; }
    await route.fulfill({ json: {
      results: [{ ...demoCourses[0], id: query === "oldneedle" ? "990" : "991", type: "file", title: query === "oldneedle" ? "Stale result" : "Fresh result" }],
      hasMore: false, page: 1,
    } });
  });
  await page.getByRole("combobox").fill("oldneedle");
  await oldStarted;
  await page.getByRole("combobox").fill("newneedle");
  await page.getByRole("option", { name: /Fresh result/ }).waitFor();
  releaseOld();
  assert.equal(await page.getByRole("option", { name: /Stale result/ }).count(), 0);
  await page.unroute("**/api/search?*");
  // A repository page containing only earlier scoped matches must not hide
  // later pages. All stages deduplicate the same resource identity.
  await page.route("**/api/search?*", async (route) => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get("q") !== "pagingneedle") return route.continue();
    const pageNumber = Number(params.get("page") || 1);
    const id = params.has("root") || pageNumber === 2 ? "996" : pageNumber === 1 ? "995" : "997";
    await route.fulfill({ json: {
      results: [{ ...demoCourses[0], id, type: "file", title: `Paged material ${id}` }],
      hasMore: !params.has("root") && pageNumber < 3, page: pageNumber,
    } });
  });
  await page.getByRole("combobox").fill("pagingneedle");
  await page.getByRole("option", { name: "Load more results", exact: true }).click();
  await page.getByRole("option", { name: "Load more results", exact: true }).click();
  await page.getByRole("option", { name: /Paged material 997/ }).waitFor();
  assert.equal(await page.getByRole("option", { name: /Paged material/ }).count(), 3);
  await page.unroute("**/api/search?*");
  await page.keyboard.press("Escape");

  // Failure is visible and retry recovers without discarding local search.
  let requests = 0;
  await page.route("**/api/search/items?demo=1", async (route) => {
    requests++;
    await route.fulfill({
      status: requests === 1 ? 502 : 200,
      json: requests === 1 ? { error: "Course list temporarily unavailable" } : {
        items: Array.from({ length: 24 }, (_, index) => ({ ...demoCourses[0], id: String(800 + index), title: `Unvisited course ${index}` })),
        hasMore: false,
      },
    });
  });
  await page.keyboard.press("Control+k");
  await page.getByText("Course list temporarily unavailable", { exact: true }).waitFor();
  await page.getByRole("option", { name: /Retry loading your courses/ }).click();
  await page.getByRole("combobox").fill("unvisited");
  await page.getByRole("option", { name: "Show all 24 matches" }).click();
  assert.equal(await page.getByRole("option", { name: /Unvisited course/ }).count(), 24);
  await page.getByRole("combobox").fill("zzzzmissing");
  await page.getByText("No matches in your course list, this page, bookmarks, or recent history.", { exact: true }).waitFor();
  assert.deepEqual(errors, []);

  const disconnected = await context.request.get(`${origin}/api/search/items`);
  assert.equal(disconnected.status(), 401);
  assert.equal(disconnected.headers()["cache-control"], "private, no-store");
  console.log("Search smoke passed: unvisited courses, nested materials, progressive scopes, retry, all matches, and authentication.");
} finally {
  await browser.close();
}
