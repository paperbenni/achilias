import { chromium } from "playwright";
import assert from "node:assert/strict";
const origin = process.env.ACHILIAS_TEST_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true });
const errors: string[] = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin);
  await page
    .getByRole("heading", { name: "Less friction. More learning." })
    .waitFor();
  await page.getByRole("link", { name: "Take a look around" }).click();
  await page.getByRole("heading", { name: "Welcome back, Alex." }).waitFor();
  await page
    .getByRole("button", { name: "Save Linear Algebra I", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Saved for later", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Linear Algebra I", exact: true })
    .waitFor();
  await page.reload();
  await page
    .getByRole("button", { name: "Linear Algebra I", exact: true })
    .waitFor();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Filter courses and materials" })
    .fill("interaction");
  assert.equal(await page.locator(".course-card").count(), 1);
  await page
    .getByRole("textbox", { name: "Filter courses and materials" })
    .fill("");
  await page.getByRole("radio", { name: "List view" }).click();
  assert.equal(await page.locator(".resource-row").count(), 4);
  await page
    .getByRole("button", {
      name: "Introduction to Computer Science",
      exact: true,
    })
    .click();
  await page.getByRole("tab", { name: "Course information" }).click();
  await page.getByText("Office hours: Tuesdays", { exact: false }).waitFor();
  await page.getByRole("tab", { name: "ILIAS tools" }).click();
  await page.getByRole("link", { name: "Members", exact: false }).waitFor();
  await page.getByRole("tab", { name: "Materials 5" }).click();
  await page
    .getByRole("button", { name: "Exercise sheet 01", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Visit Freiburg ILIAS" })
    .waitFor();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Lecture materials", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Lecture materials", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "01 — Getting started.pdf", exact: true })
    .click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download example PDF" }).click();
  const download = await downloaded;
  assert.equal(download.suggestedFilename(), "achilias-example.pdf");
  assert.equal(await download.failure(), null);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill("linear");
  await page.getByRole("option", { name: /Linear Algebra I/ }).click();
  await page
    .getByRole("heading", { name: "Linear Algebra I", exact: true })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await page
    .getByRole("link", { name: "Saved for later", exact: true })
    .click();
  await page.getByRole("heading", { name: "Saved for later." }).waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
    "Mobile layout overflows",
  );
  await page.goto(origin + "/settings?demo=1");
  await page
    .getByRole("heading", { name: "A clear view of what’s here." })
    .waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
    "Settings overflows on mobile",
  );
  const invalid = await page.request.post(origin + "/api/connect", {
    headers: { Origin: "https://other.example" },
    data: { instance: "https://ilias.uni-freiburg.de/" },
  });
  assert.equal(invalid.status(), 400);
  const unauth = await page.request.get(origin + "/api/files/123");
  assert.equal(unauth.status(), 401);
  const pairing = await page.request.post(origin + "/api/session/import", {
    headers: { Origin: origin },
    data: { token: "invalid" },
  });
  assert.equal(pairing.status(), 400);
  assert.deepEqual(errors, []);
  console.log(
    "Passed: onboarding, navigation, saved-item persistence, filtering, list view, course tabs, activity handoff, folders, PDF download, quick search, mobile navigation/layout, API origin checks, unauthenticated download, invalid pairing.",
  );
} finally {
  await browser.close();
}
