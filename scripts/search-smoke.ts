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
  await page.getByRole("option", { name: /Search ILIAS for/ }).click();
  await page.getByText("Introduction to Computer Science › Exercise groups").waitFor();
  assert.equal(await page.getByRole("option", { name: /Gruppe 02/ }).count(), 3);
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
  console.log("Search smoke passed: unvisited courses, navigation, deep search, retry, all matches, and authentication.");
} finally {
  await browser.close();
}
