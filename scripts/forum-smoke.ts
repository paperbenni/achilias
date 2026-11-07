import { chromium } from "playwright";
import assert from "node:assert/strict";
const origin = process.env.ACHILIAS_TEST_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/browse/crs/101?demo=1`);
  await page
    .getByRole("button", {
      name: "Bookmark Questions & discussion",
      exact: true,
    })
    .click();
  await page.getByRole("link", { name: "Bookmarks", exact: true }).click();
  await page.getByRole("heading", { name: "Bookmarks", exact: true }).waitFor();
  await page
    .getByRole("link", { name: "Questions & discussion", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Questions & discussion", exact: true })
    .waitFor();
  assert.match(
    await page
      .getByRole("link", { name: /Why does binary search need a sorted array\?/ })
      .innerText(),
    /I understand that binary search discards half the array/,
  );
  assert.equal(new URL(page.url()).pathname, "/forums/402");
  assert.equal(
    await page
      .getByRole("list", { name: "Forum discussions" })
      .getByRole("listitem")
      .count(),
    5,
  );
  await page.getByRole("radio", { name: "Unread 2", exact: true }).click();
  assert.equal(
    await page
      .getByRole("list", { name: "Forum discussions" })
      .getByRole("listitem")
      .count(),
    2,
  );
  await page
    .getByRole("textbox", { name: "Search discussions on this page" })
    .fill("Maya");
  assert.equal(
    await page
      .getByRole("list", { name: "Forum discussions" })
      .getByRole("listitem")
      .count(),
    1,
  );
  await page
    .getByRole("textbox", { name: "Search discussions on this page" })
    .fill("does not exist");
  await page.getByText("No matching discussions", { exact: true }).waitFor();
  await page
    .getByRole("textbox", { name: "Search discussions on this page" })
    .fill("");
  await page
    .getByRole("radio", { name: "All discussions 5", exact: true })
    .click();
  await page.getByRole("combobox", { name: "Sort discussions" }).click();
  await page.getByRole("option", { name: "Title A–Z", exact: true }).click();
  await page
    .getByRole("link", {
      name: /Why does binary search need a sorted array\?/,
    })
    .click();
  await page
    .getByRole("heading", {
      name: "Why does binary search need a sorted array?",
      exact: true,
    })
    .waitFor();
  assert.equal(await page.getByRole("article").count(), 4);
  assert.equal(
    await page.locator(".forum-prose pre code").textContent(),
    "[8, 2, 11, 4, 6, 1, 9]",
  );
  await page.getByRole("link", { name: "Jump to unread", exact: true }).click();
  assert.equal(new URL(page.url()).hash, "#post-1013");
  await page
    .getByRole("link", { name: "In reply to Jonas Becker", exact: true })
    .click();
  assert.equal(new URL(page.url()).hash, "#post-1012");
  await page
    .getByRole("button", {
      name: "Copy link to post by Jonas Becker",
      exact: true,
    })
    .click();
  assert.equal(
    new URL(await page.evaluate(() => navigator.clipboard.readText())).hash,
    "#post-1012",
  );
  await page
    .getByRole("textbox", { name: "Search posts on this page" })
    .fill("dictionary");
  assert.equal(await page.getByRole("article").count(), 1);
  await page
    .getByRole("textbox", { name: "Search posts on this page" })
    .fill("");
  await page
    .getByRole("button", { name: "Mark thread read", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("link", { name: "Jump to unread", exact: true })
      .count(),
    0,
  );
  await page.reload();
  await page
    .getByRole("heading", {
      name: "Why does binary search need a sorted array?",
      exact: true,
    })
    .waitFor();
  await page
    .getByRole("button", { name: "Mark thread read", exact: true })
    .waitFor({ state: "hidden" });
  await page.getByRole("radio", { name: "Newest first", exact: true }).click();
  await page.waitForURL(/order=newest/);
  await page.waitForFunction(
    () => document.querySelector("article")?.id === "post-1014",
  );
  await page
    .getByRole("link", { name: "Questions & discussion", exact: true })
    .click();
  await page.getByRole("radio", { name: "Unread 1", exact: true }).click();
  assert.equal(
    await page
      .getByRole("list", { name: "Forum discussions" })
      .getByRole("listitem")
      .count(),
    1,
  );
  await page
    .getByRole("radio", { name: "All discussions 5", exact: true })
    .click();
  await page
    .getByRole("link", { name: /Week 1: lecture room change Closed/ })
    .click();
  await page
    .getByRole("heading", { name: "Week 1: lecture room change", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("link", { name: "Reply in ILIAS", exact: true })
      .count(),
    0,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/forums/402?demo=1`);
  await page
    .getByRole("heading", { name: "Questions & discussion", exact: true })
    .waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "Forum overflows on mobile",
  );
  await page
    .getByRole("link", {
      name: /Why does binary search need a sorted array\?/,
    })
    .click();
  await page
    .getByRole("heading", {
      name: "Why does binary search need a sorted array?",
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "Thread overflows on mobile",
  );
  const endpoint = `${origin}/api/forums/402/threads/902/read`;
  assert.equal(
    (
      await page.request.post(endpoint, {
        headers: { Origin: "https://other.example" },
      })
    ).status(),
    403,
  );
  assert.equal(
    (
      await page.request.post(endpoint, { headers: { Origin: origin } })
    ).status(),
    401,
  );
  assert.equal((await page.request.get(endpoint)).status(), 405);
  const previewEndpoint = `${origin}/api/forums/402/threads/902/preview`;
  assert.equal(
    (
      await page.request.post(previewEndpoint, {
        headers: { Origin: "https://other.example" },
      })
    ).status(),
    403,
  );
  assert.equal(
    (
      await page.request.post(previewEndpoint, { headers: { Origin: origin } })
    ).status(),
    401,
  );
  assert.equal((await page.request.get(previewEndpoint)).status(), 405);
  await page.goto(`${origin}/forums/402?demo=1&page=invalid`);
  await page.getByText("Page not found", { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "Passed: saved forum navigation, topic previews, thread filters/sorting, empty search, formatted posts, unread jumps, reply context, copy link, post search, demo read-state persistence, chronological order, closed-thread actions, mobile layouts, read/preview action authorization and invalid routes.",
  );
} finally {
  await browser.close();
}
