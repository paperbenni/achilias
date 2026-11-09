import { chromium } from "playwright";
import assert from "node:assert/strict";

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto((process.env.ACHILIAS_TEST_URL || "http://127.0.0.1:3000") + "/?demo=1");
  await page.getByRole("heading", { name: "Overview", exact: true }).waitFor();
  await page.getByRole("button", { name: "Keyboard shortcuts" }).click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  await page.keyboard.press("/");
  await page.getByRole("combobox").waitFor();
  await page.keyboard.type("hjkl/f?");
  assert.equal(await page.getByRole("combobox").inputValue(), "hjkl/f?");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  await page.waitForTimeout(200);
  await page.keyboard.press("Control+k");
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  await page.waitForTimeout(200);
  await page.locator("body").click({ position: { x: 800, y: 5 } });
  await page.keyboard.press("j");
  const before = await page.evaluate(() => document.activeElement?.outerHTML);
  assert.notEqual(await page.evaluate(() => document.activeElement?.tagName), "BODY");
  await page.keyboard.press("j");
  assert.notEqual(await page.evaluate(() => document.activeElement?.outerHTML), before);
  await page.keyboard.press("f");
  const hint = page.locator("kbd").filter({ hasText: /^a+$/ }).last();
  await hint.waitFor();
  assert.equal(await hint.evaluate((el) => el.parentElement?.parentElement === document.body), true, "Hints must escape the sidebar stacking context");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  await page.keyboard.press("f");
  await hint.waitFor();
  assert.equal(await hint.evaluate((el) => el.parentElement?.parentElement === document.body), true, "Hints must escape the sidebar stacking context");
  const searchHint = await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll("button")).find((el) => el.textContent?.includes("Quick search"))!;
    const rect = button.getBoundingClientRect();
    return Array.from(document.querySelectorAll("kbd")).find((el) =>
      el.style.left === Math.max(0, rect.left) + "px" && el.style.top === Math.max(0, rect.top) + "px")?.textContent;
  });
  assert.ok(searchHint);
  await page.keyboard.type(searchHint);
  await page.getByRole("combobox").waitFor();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  // Resource navigation uses primary actions; Tab still reaches secondary ones.
  const cards = page.locator(".course-card");
  assert.ok(await cards.count() > 1);
  const firstPrimary = cards.first().locator(".resource-primary");
  await firstPrimary.focus();
  await page.keyboard.press("l");
  assert.equal(await page.evaluate(() => document.activeElement?.classList.contains("resource-primary")), true);
  assert.equal(await firstPrimary.evaluate((el) => el === document.activeElement), false);
  await firstPrimary.focus();
  await page.keyboard.press("Tab");
  assert.equal(await cards.first().evaluate((el) => el.contains(document.activeElement) && document.activeElement?.tagName === "BUTTON"), true);
  const buttonFocus = await page.evaluate(() => ({
    outline: getComputedStyle(document.activeElement!).outlineStyle,
    shadow: getComputedStyle(document.activeElement!).boxShadow,
  }));
  assert.equal(buttonFocus.outline, "none", "Buttons retain shadcn focus styling");
  assert.notEqual(buttonFocus.shadow, "none", "Keyboard focus remains visible");
  assert.equal(await cards.first().evaluate((el) => getComputedStyle(el).outlineStyle), "none");
  await page.keyboard.press("Shift+Tab");
  assert.equal(await firstPrimary.evaluate((el) => el === document.activeElement), true);
  assert.equal(await cards.first().evaluate((el) => getComputedStyle(el).outlineWidth), "2px");
  assert.equal(await firstPrimary.evaluate((el) => getComputedStyle(el).outlineStyle), "none");
  await page.screenshot({ path: "/tmp/achilias-keyboard-focus.png" });
  await page.keyboard.press("?");
  await page.getByRole("dialog").waitFor();
  await page.getByRole("checkbox", { name: "Enable single-key shortcuts" }).uncheck();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  await page.waitForTimeout(200);
  await page.keyboard.press("/");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.reload();
  await page.getByRole("button", { name: "Keyboard shortcuts" }).waitFor();
  await page.keyboard.press("/");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.keyboard.press("Control+k");
  await page.getByRole("dialog").waitFor();
  console.log("Keyboard shortcuts smoke passed");
} finally {
  await browser.close();
}
