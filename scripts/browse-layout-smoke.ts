import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(10_000);
  const origin = process.env.ACHILIAS_TEST_URL || "http://127.0.0.1:3000";
  const description = "Algorithms, data structures, and the art of solving problems.";
  for (const width of [1501, 390, 320]) {
    await page.setViewportSize({ width, height: 922 });
    for (const path of ["/browse/crs/101", "/browse/fold/201"]) {
      await page.goto(origin + path + "?demo=1");
      const heading = page.getByRole("heading", { level: 1 });
      await heading.waitFor();
      const back = page.getByRole("link", { name: /^Back to / });
      const refresh = page.getByRole("button", { name: "Refresh", exact: true });
      await refresh.waitFor();
      const titleBounds = await heading.boundingBox();
      for (const control of [back, refresh]) {
        const bounds = await control.boundingBox();
        assert.ok(bounds && titleBounds);
        assert.ok(Math.abs(bounds.y + bounds.height / 2 - titleBounds.y - titleBounds.height / 2) < 2,
          "Title and icon controls should share a vertical center");
      }
      assert.equal((await back.innerText()).trim(), "", "Back control has no visible title");
      const first = await page.locator(".course-card, .resource-row").first().boundingBox();
      assert.ok(first && first.y < (width > 1000 ? 240 : 420), "Contents should be visible near the top");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: `/tmp/achilias-browse-${width}-${path.endsWith("101") ? "course" : "folder"}.png` });
      if (path.endsWith("101")) {
        assert.equal(await page.getByText(description, { exact: true }).isVisible(), false);
        await page.getByRole("tab", { name: "Details", exact: true }).click();
        await page.getByText(description, { exact: true }).waitFor();
        await page.getByRole("tab", { name: "Tools", exact: true }).click();
        await page.getByText("Course tools in ILIAS", { exact: true }).waitFor();
        await page.getByRole("tab", { name: "Materials 5", exact: true }).click();
        await page.getByRole("textbox", { name: "Filter materials" }).waitFor();
      }
    }
  }
  console.log("Compact course/folder layout, icon alignment, details/tools, and mobile widths passed");
} finally {
  await browser.close();
}
