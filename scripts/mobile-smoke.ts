import { chromium, type Locator } from "playwright";
import assert from "node:assert/strict";

// Uses only the demo and signed-out pages: no live account or upstream writes.
const origin = process.env.ACHILIAS_TEST_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const routes = [
    "/?demo=1", "/courses?demo=1", "/saved?demo=1", "/settings?demo=1",
    "/browse/crs/101?demo=1", "/browse/fold/201?demo=1",
    "/forums/402?demo=1", "/forums/402/threads/901?demo=1",
    "/exercises/401?demo=1", "/exercises/401/units/501?demo=1",
    "/exercises/401/units/new?demo=1", "/", "/settings",
  ];
  async function open(route: string) {
    await page.goto(origin + route);
    await page.getByRole("heading", { level: 1 }).first().waitFor();
    await page.evaluate(() => document.fonts.ready);
  }
  async function fitsPage() {
    const width = page.viewportSize()!.width;
    const actual = await page.evaluate(() => document.documentElement.scrollWidth);
    // On mobile Chromium, overflow can enlarge innerWidth and scale the whole
    // page down. Compare with the configured viewport, not window.innerWidth.
    assert.ok(actual <= width + 1, `${page.url()} overflows ${width}px: ${actual}px`);
  }
  async function fitsDialog() {
    const dialog = page.getByRole("dialog").last();
    await dialog.waitFor();
    // Wait for entrance animation before checking its final bounds.
    await page.waitForFunction(() => {
      const dialog = document.querySelector('[data-slot="dialog-content"]');
      return dialog && dialog.getAnimations().every((animation) => animation.playState === "finished");
    });
    const bounds = await dialog.boundingBox();
    assert.ok(bounds && bounds.y >= 0 && bounds.x >= 0);
    assert.ok(bounds.y + bounds.height <= page.viewportSize()!.height + 1);
    assert.ok(bounds.x + bounds.width <= page.viewportSize()!.width + 1);
  }
  async function touchTarget(control: Locator) {
    const bounds = await control.boundingBox();
    assert.ok(bounds && bounds.height >= 44 && bounds.width >= 44,
      `Small touch target: ${await control.getAttribute("aria-label")}`);
  }

  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of routes) {
      await open(route);
      await fitsPage();
    }
  }

  await page.setViewportSize({ width: 844, height: 390 });
  await open("/forums/402/threads/901?demo=1");
  await fitsPage();
  await touchTarget(page.getByRole("button", { name: "Quick search", exact: true }));
  await page.locator(".forum-prose").first().evaluate((body) => {
    const link = document.createElement("p");
    link.textContent = "https://example.edu/" + "long-unbroken-path".repeat(40);
    const code = document.createElement("pre");
    code.textContent = "a long code line ".repeat(100);
    body.append(link, code);
  });
  await fitsPage();

  await page.setViewportSize({ width: 320, height: 844 });
  await open("/browse/crs/101?demo=1");
  await touchTarget(page.getByRole("button", { name: "Toggle Sidebar", exact: true }));
  await touchTarget(page.getByRole("button", { name: "Bookmark Lecture materials", exact: true }));
  // The last tab must be reachable without making the whole page scroll.
  await page.getByRole("tab", { name: "Tools", exact: true }).tap();
  await page.getByText("Course tools in ILIAS", { exact: true }).waitFor();
  await fitsPage();

  await page.getByRole("button", { name: "Toggle Sidebar", exact: true }).tap();
  await page.getByRole("button", { name: "Close navigation" }).tap();
  await page.getByRole("dialog", { name: "Sidebar", exact: true }).waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Toggle Sidebar", exact: true }).tap();
  await page.getByRole("link", { name: "My courses", exact: true }).tap();
  await page.getByRole("heading", { name: "Courses", exact: true }).waitFor();
  await page.getByRole("dialog", { name: "Sidebar", exact: true }).waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Toggle Sidebar", exact: true }).tap();
  await page.getByRole("button", { name: "Quick search", exact: true }).tap();
  await page.getByRole("combobox").waitFor();
  await page.waitForFunction(() => document.querySelectorAll('[role="dialog"]').length === 1);
  await fitsDialog();
  assert.ok(await page.getByRole("combobox").evaluate((el) => parseFloat(getComputedStyle(el).fontSize)) >= 16);
  await touchTarget(page.getByRole("button", { name: "Close", exact: true }));
  await page.getByRole("button", { name: "Close", exact: true }).tap();
  await page.getByRole("dialog").waitFor({ state: "hidden" });

  // Short viewports cover landscape and a reduced area above the keyboard.
  await page.setViewportSize({ width: 390, height: 360 });
  await page.getByRole("button", { name: "Quick search", exact: true }).tap();
  await fitsDialog();
  await page.getByRole("button", { name: "Close", exact: true }).tap();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Sign in", exact: true }).tap();
  await fitsDialog();
  await page.getByRole("button", { name: "Close", exact: true }).tap();
  await page.getByRole("dialog").waitFor({ state: "hidden" });

  await page.setViewportSize({ width: 320, height: 568 });
  await open("/exercises/401/units/501?demo=1");
  await page.getByRole("button", { name: "Assess", exact: true }).first().tap();
  await fitsDialog();
  await page.getByRole("button", { name: "Save demo assessment", exact: true }).scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Close", exact: true }).tap();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("tab", { name: "Unit settings", exact: true }).tap();
  await page.getByRole("textbox", { name: "Title / Titel", exact: true }).waitFor();
  await fitsPage();

  assert.deepEqual(errors, []);
  await context.close();
  console.log("Passed: phone/tablet layouts, touch targets, scrollable tabs, navigation, search, and short-screen dialogs.");
} finally {
  await browser.close();
}
