import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(10_000);
  const origin = process.env.ACHILIAS_TEST_URL || "http://127.0.0.1:3000";
  const nav = page.getByRole("navigation", { name: "Breadcrumb", exact: true });
  const course = "Introduction to Computer Science";
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const courseLink = () => page.getByRole("main").getByRole("link", { name: course, exact: true }).first();
  await page.goto(origin + "/courses?demo=1");
  await courseLink().click();
  await page.getByRole("link", { name: "Back to My courses", exact: true }).waitFor();
  assert.ok((await nav.innerText()).includes("My courses"));
  assert.equal(await nav.getByRole("button", { name: "Show ILIAS location" }).count(), 0);
  await page.getByRole("main").getByRole("link", { name: "Lecture materials", exact: true }).click();
  await page.getByRole("link", { name: "Back to " + course, exact: true }).waitFor();
  await page.reload();
  await page.getByRole("link", { name: "Back to " + course, exact: true }).waitFor();
  await page.getByRole("link", { name: "Back to " + course, exact: true }).click();
  await page.getByRole("link", { name: "Back to My courses", exact: true }).waitFor();
  await page.goBack();
  await page.getByRole("link", { name: "Back to " + course, exact: true }).waitFor();
  await page.goForward();
  await page.getByRole("link", { name: "Back to My courses", exact: true }).waitFor();

  // Opening a folder directly should not pretend its course was visited.
  const direct = await browser.newPage();
  await direct.goto(origin + "/browse/fold/201?demo=1");
  const directNav = direct.getByRole("navigation", { name: "Breadcrumb", exact: true });
  await direct.getByRole("link", { name: "Back to My courses", exact: true }).waitFor();
  await directNav.getByRole("button", { name: "Show ILIAS location" }).click();
  await direct.getByRole("menuitem", { name: course, exact: true }).waitFor();
  await direct.keyboard.press("Escape");
  await direct.close();

  // Sidebar entry points start a fresh trail.
  await page.getByRole("navigation", { name: "Workspace", exact: true }).getByRole("link", { name: "Overview", exact: true }).click();
  await page.waitForURL("**/?demo=1");
  await courseLink().click();
  await page.getByRole("link", { name: "Back to Overview", exact: true }).waitFor();
  // Each history entry retains its own origin, including repeated URLs.
  await page.goBack();
  await page.waitForURL("**/?demo=1");
  await page.goBack();
  await page.getByRole("link", { name: "Back to My courses", exact: true }).waitFor();
  await page.getByRole("navigation", { name: "Workspace", exact: true }).getByRole("link", { name: "My courses", exact: true }).click();
  await page.waitForURL("**/courses?demo=1");
  await page.getByRole("button", { name: "Bookmark " + course, exact: true }).click();
  await page.getByRole("navigation", { name: "Workspace", exact: true }).getByRole("link", { name: "Bookmarks", exact: true }).click();
  await page.waitForURL("**/saved?demo=1");
  await courseLink().click();
  await page.getByRole("link", { name: "Back to Bookmarks", exact: true }).waitFor();
  await page.reload();
  await page.getByRole("link", { name: "Back to Bookmarks", exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log("Breadcrumb navigation, reload, browser back/forward, direct links and hierarchy menu passed");
} finally {
  await browser.close();
}
