import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const origin = process.env.ACHILIAS_TEST_URL || "http://127.0.0.1:3000";
  page.setDefaultTimeout(10_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const result = (id: string, title: string, type = "file") => ({
    id, title, type, available: true, description: "", meta: "",
    sourceUrl: `https://ilias.example/goto.php?target=${type}_${id}`,
  });
  let fail = true;
  let release: (() => void) | undefined;
  let started: (() => void) | undefined;
  await page.route("**/api/search?*", async (route) => {
    const params = new URL(route.request().url()).searchParams;
    assert.ok(params.get("root"));
    const q = params.get("q");
    if (q === "pendingneedle") {
      started?.();
      await new Promise<void>((resolve) => { release = resolve; });
    }
    if (q === "retryneedle" && fail) {
      fail = false;
      return route.fulfill({ status: 502, json: { error: "Temporary failure" } });
    }
    await route.fulfill({ json: {
      results: q === "missingneedle" ? [] : q === "Lecture" ? [result("201", "Lecture materials", "fold")] : [
        result("990", q === "pendingneedle" ? "Stale material" : "Deep material"),
        result("102", "Other course", "crs"),
      ],
      hasMore: q === "Lecture",
      sourceUrl: "https://ilias.example/search", page: 1,
    } });
  });
  await page.goto(origin + "/browse/crs/101?demo=1");
  const filter = page.getByRole("textbox", { name: "Filter materials" });
  const search = page.getByRole("button", { name: "Search this course and its subfolders" });
  await filter.fill("retryneedle");
  await search.click();
  await page.getByRole("alert").filter({ hasText: "Temporary failure" }).waitFor();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.getByRole("link", { name: "Deep material", exact: true }).waitFor();
  await page.getByRole("link", { name: "Other course", exact: true }).click();
  await page.waitForURL("**/browse/crs/102?demo=1");
  assert.equal(await page.getByRole("link", { name: "Deep material", exact: true }).count(), 0);
  // A pending search must also be discarded when leaving its container.
  await filter.fill("pendingneedle");
  const navigating = new Promise<void>((resolve) => { started = resolve; });
  await search.click();
  await navigating;
  await page.goBack();
  await page.waitForURL("**/browse/crs/101?demo=1");
  release?.();
  assert.equal(await page.getByRole("link", { name: "Stale material", exact: true }).count(), 0);
  await filter.fill("resetneedle");
  await filter.fill("pendingneedle");
  const pending = new Promise<void>((resolve) => { started = resolve; });
  await search.click();
  await pending;
  await page.getByRole("status").filter({ hasText: "Searching this course" }).waitFor();
  await filter.fill("missingneedle");
  await search.click();
  await page.getByText("Searched this course and its subfolders too.", { exact: false }).waitFor();
  release?.();
  await page.getByRole("link", { name: "Open this search in ILIAS" }).waitFor();
  assert.equal(await page.getByRole("link", { name: "Stale material", exact: true }).count(), 0);
  await page.goto(origin + "/browse/crs/101?demo=1");
  await filter.fill("Lecture");
  await search.click();
  await page.getByText("No additional matches on this result page.", { exact: true }).waitFor();
  await page.getByText("ILIAS has more results than shown here.", { exact: true }).waitFor();
  await page.getByRole("link", { name: "Open this search in ILIAS" }).waitFor();
  assert.equal(await page.getByText("No other matches in this course or its subfolders.", { exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  console.log("Browse search: retry, results, navigation isolation, stale requests, empty results and duplicate pages passed");
} finally {
  await browser.close();
}
