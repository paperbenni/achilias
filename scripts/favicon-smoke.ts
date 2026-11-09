import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = process.env.ACHILIAS_TEST_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  for (const path of ["/?demo=1", "/browse/fold/201?demo=1"]) {
    await page.goto(origin + path);
    await page.getByRole("heading", { level: 1 }).waitFor();
    const links = await page.locator('link[rel="icon"]').evaluateAll((elements) =>
      elements.map((el) => ({
        href: (el as HTMLLinkElement).href,
        type: (el as HTMLLinkElement).type,
      })),
    );
    assert.ok(links.some((link) => new URL(link.href).pathname === "/icon.svg"));
    assert.ok(links.some((link) => new URL(link.href).pathname === "/icons/favicon-32.png"));
    assert.ok(links.some((link) => new URL(link.href).pathname === "/favicon.ico"));
    for (const link of links) {
      const response = await page.request.get(link.href);
      assert.equal(response.status(), 200);
      assert.match(response.headers()["content-type"], /^image\//);
      assert.equal(await page.evaluate(async (href) => {
        const image = new Image();
        image.src = href;
        await image.decode();
        return image.naturalWidth > 0 && image.naturalHeight > 0;
      }, link.href), true, "Browser could not decode " + link.href);
    }
  }
  const response = await page.request.get(origin + "/favicon.ico");
  const ico = await response.body();
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 3);
  assert.deepEqual([ico[6], ico[22], ico[38]], [16, 32, 48]);
  console.log("Favicon declarations, HTTP types, ICO sizes and browser image decoding passed");
} finally {
  await browser.close();
}
