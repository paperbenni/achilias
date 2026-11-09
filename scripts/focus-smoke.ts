import assert from "node:assert/strict";
import { chromium, type Locator } from "playwright";

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const origin = process.env.ACHILIAS_TEST_URL || "http://127.0.0.1:3000";
  async function checkGroup(input: Locator) {
    await input.focus();
    const styles = await input.evaluate((el) => {
      const group = el.closest('[data-slot="input-group"]')!;
      const style = getComputedStyle(el);
      const groupStyle = getComputedStyle(group);
      const rect = el.getBoundingClientRect();
      const bounds = group.getBoundingClientRect();
      return {
        outline: style.outlineStyle,
        groupOutline: groupStyle.outlineStyle,
        groupWidth: groupStyle.outlineWidth,
        radius: groupStyle.borderRadius,
        inside: rect.left >= bounds.left && rect.right <= bounds.right,
      };
    });
    assert.equal(styles.outline, "none", "Inner input should not draw a second rectangle");
    assert.equal(styles.groupOutline, "solid");
    assert.equal(styles.groupWidth, "2px");
    assert.notEqual(styles.radius, "0px");
    assert.equal(styles.inside, true);
  }
  for (const theme of ["light", "dark"]) {
    await page.goto(origin + "/?demo=1");
    await page.evaluate((theme) => localStorage.setItem("theme", theme), theme);
    await page.reload();
    await page.getByRole("heading", { name: "Overview", exact: true }).waitFor();
    // Keyboard modality ensures :focus-visible is active.
    await page.keyboard.press("Tab");
    await checkGroup(page.getByPlaceholder("Find a course or group…"));
    await page.screenshot({ path: "/tmp/achilias-filter-focus-" + theme + ".png" });
    await page.keyboard.press("Control+k");
    const search = page.getByRole("combobox");
    await search.waitFor();
    await checkGroup(search);
    await search.fill("computer");
    await page.screenshot({ path: "/tmp/achilias-search-focus-" + theme + ".png" });
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
  }
  console.log("Compound search focus checks passed in light and dark themes");
} finally {
  await browser.close();
}
