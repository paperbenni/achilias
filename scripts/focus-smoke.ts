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
        groupShadow: groupStyle.boxShadow,
        radius: groupStyle.borderRadius,
        inside: rect.left >= bounds.left && rect.right <= bounds.right,
      };
    });
    assert.equal(styles.outline, "none", "Inner input should not draw a second rectangle");
    assert.equal(styles.groupOutline, "none");
    assert.ok(styles.groupShadow === "none" || !styles.groupShadow.replaceAll("rgba(0, 0, 0, 0)", "").match(/[1-9]/), "No visible focus shadow");
    assert.notEqual(styles.radius, "0px");
    assert.equal(styles.inside, true);
  }
  async function checkOrdinarySelection(item: Locator) {
    const outline = await item.evaluate((el) => {
      const style = getComputedStyle(el);
      return { style: style.outlineStyle, color: style.outlineColor };
    });
    assert.ok(outline.style === "none" || outline.color === "transparent" ||
      /(?:rgba|oklab|oklch|color).*[,/]\s*0\)$/.test(outline.color),
      "Radix options should use shadcn selection styling without an extra outline: " + JSON.stringify(outline));
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
    await page.goto(origin + "/forums/402?demo=1");
    const sort = page.getByRole("combobox", { name: "Sort discussions" });
    await sort.click();
    const option = page.getByRole("option", { name: "Title A–Z" });
    await option.hover();
    await checkOrdinarySelection(option);
    await page.screenshot({ path: "/tmp/achilias-select-" + theme + ".png" });
    await option.click();
    await page.getByRole("listbox").waitFor({ state: "hidden" });
    assert.equal(await sort.innerText(), "Title A–Z");
    // Keyboard selection keeps the same shadcn option highlight.
    await sort.focus();
    await page.keyboard.press("ArrowDown");
    await page.getByRole("listbox").waitFor();
    await page.keyboard.press("ArrowDown");
    await checkOrdinarySelection(page.locator('[role="option"]:focus'));
    await page.keyboard.press("Escape");
    await page.getByRole("listbox").waitFor({ state: "hidden" });
    await page.locator('[data-slot="sidebar-footer"] [data-slot="dropdown-menu-trigger"]').click();
    const light = page.getByRole("menuitemradio", { name: "Light", exact: true });
    await light.hover();
    await checkOrdinarySelection(light);
    await page.keyboard.press("ArrowDown");
    await checkOrdinarySelection(page.locator('[role="menuitemradio"]:focus'));
    await page.keyboard.press("Escape");
    await page.getByRole("menu").waitFor({ state: "hidden" });
  }
  console.log("Search fields and mouse/keyboard select and menu styling passed in light and dark themes");
} finally {
  await browser.close();
}
