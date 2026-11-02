import { chromium, expect } from "playwright/test";
import assert from "node:assert/strict";
const origin = process.env.ACHILIAS_TEST_URL || "http://127.0.0.1:3001";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1364, height: 1000 } });
const errors: string[] = [];
page.on("pageerror", (error) => errors.push(error.message));
async function clickPadding(selector: string, title: string) {
  const entry = page
    .locator(selector)
    .filter({ has: page.getByRole("button", { name: title, exact: true }) });
  await entry.scrollIntoViewIfNeeded();
  const box = await entry.boundingBox();
  assert.ok(box);
  await page.mouse.click(box.x + 12, box.y + box.height - 8);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
}
async function close() {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
}
try {
  await page.goto(origin + "/browse/crs/101?demo=1");
  const title = "Check your understanding";
  await page
    .getByRole("button", { name: `Bookmark ${title}`, exact: true })
    .click();
  assert.equal(
    await page.getByRole("dialog").count(),
    0,
    "Bookmark click opened details",
  );
  await clickPadding(".course-card", title);
  await close();
  for (const key of ["Enter", "Space"]) {
    await page.getByRole("button", { name: title, exact: true }).focus();
    await page.keyboard.press(key);
    await expect(page.getByRole("dialog")).toBeVisible();
    await close();
  }
  assert.equal(
    await page
      .getByText("Open this learning space to find your materials.", {
        exact: true,
      })
      .count(),
    0,
  );
  await page.getByRole("radio", { name: "List view", exact: true }).click();
  await clickPadding(".resource-row", title);
  await close();
  // Supported row links must retain the same large hit area after changing the
  // primary text action to a normal link rather than an animated Button slot.
  const folder = page
    .locator(".resource-row")
    .filter({
      has: page.getByRole("link", { name: "Lecture materials", exact: true }),
    });
  await folder.scrollIntoViewIfNeeded();
  const box = await folder.boundingBox();
  assert.ok(box);
  await page.mouse.click(box.x + 12, box.y + box.height - 8);
  await expect(
    page.getByRole("heading", { name: "Lecture materials", exact: true }),
  ).toBeVisible();
  // A legacy unknown object exercises the exact generic ILIAS-object path.
  await page.evaluate(() =>
    localStorage.setItem(
      "achilias:demo:v1",
      JSON.stringify({
        saved: [
          {
            id: "999999",
            type: "unknown",
            title: "Unknown activity",
            description: "",
            meta: "",
            available: true,
            sourceUrl:
              "https://ilias.uni-freiburg.de/goto.php?target=unknown_999999",
          },
        ],
        recent: [],
      }),
    ),
  );
  await page.goto(origin + "/saved?demo=1");
  await clickPadding(".resource-row", "Unknown activity");
  await close();
  await page.setViewportSize({ width: 390, height: 844 });
  await clickPadding(".resource-row", "Unknown activity");
  assert.deepEqual(errors, []);
  console.log(
    "Passed: unsupported card/row padding opens details, bookmarks stay independent, Enter/Space work, supported rows still navigate, unknown objects work on mobile, and filler descriptions are absent.",
  );
} finally {
  await browser.close();
}
