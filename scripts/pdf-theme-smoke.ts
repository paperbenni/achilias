import { chromium, expect } from "playwright/test";
import assert from "node:assert/strict";
const origin = process.env.ACHILIAS_TEST_URL || "http://127.0.0.1:3001";
// Full Chromium's new headless mode includes the native PDF viewer.
const browser = await chromium.launch({ channel: "chromium", headless: true });
const context = await browser.newContext({
  colorScheme: "light",
  viewport: { width: 1364, height: 838 },
});
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", (error) => errors.push(error.message));
async function appearance(choice: string) {
  await page.getByRole("button", { name: /Alex Exploring/ }).click();
  await page.getByRole("menuitemradio", { name: choice, exact: true }).click();
}
try {
  await page.goto(origin + "/browse/crs/101?demo=1");
  await appearance("Dark");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await appearance("Light");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await appearance("System");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/dark/);
  const another = await context.newPage();
  await another.goto(origin + "/?demo=1");
  await appearance("Dark");
  await expect(another.locator("html")).toHaveClass(/dark/);
  await another.close();
  const opened = page.waitForEvent("popup");
  const responsePromise = context.waitForEvent("response", {
    predicate: (response) =>
      new URL(response.url()).pathname === "/api/files/301",
  });
  await page
    .getByRole("link", { name: "Course handbook.pdf", exact: true })
    .click();
  const pdf = await opened;
  const response = await responsePromise;
  assert.match(response.headers()["content-disposition"], /^inline/);
  assert.equal(response.headers()["content-type"], "application/pdf");
  await expect
    .poll(() =>
      pdf
        .frames()
        .some((frame) => frame.url().startsWith("chrome-extension://")),
    )
    .toBe(true);
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(new URL(page.url()).pathname, "/browse/crs/101");
  await pdf.close();
  // Quick search uses the same file opening behavior, without a details modal.
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill("Course handbook");
  const searchOpened = page.waitForEvent("popup");
  await page
    .getByRole("option")
    .filter({ hasText: "Course handbook.pdf" })
    .first()
    .click();
  const searchPdf = await searchOpened;
  await searchPdf.waitForURL(/\/api\/files\/301.*view=1/, {
    waitUntil: "commit",
  });
  await searchPdf.close();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Toggle Sidebar", exact: true })
    .click();
  await appearance("Light");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  assert.deepEqual(errors, []);
  console.log(
    "Passed: PDF titles and quick search open native Chromium PDF tabs, no details dialog; light/dark/system persists, follows OS changes, syncs tabs and works on mobile.",
  );
} finally {
  await browser.close();
}
