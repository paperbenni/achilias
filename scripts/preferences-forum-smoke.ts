import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { chromium } from "playwright";
import { saveSession, deleteSession, SESSION_COOKIE, READ_ONLY_COOKIE } from "../src/lib/ilias/session";

const origin = process.env.ACHILIAS_TEST_URL || "http://127.0.0.1:3000";
const id = randomUUID();
const connection = createHash("sha256").update(id).digest("hex").slice(0, 16);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(10_000);
  for (const width of [1501, 390]) {
    await page.setViewportSize({ width, height: 922 });
    for (const path of ["/", "/login"]) {
      await page.goto(origin + path);
      const brand = page.getByRole("link", { name: "Achilias home" });
      await brand.waitFor();
      assert.ok((await brand.locator("svg").boundingBox())!.height >= 44);
      assert.ok(await brand.locator("span").last().evaluate((el) => parseFloat(getComputedStyle(el).fontSize) >= 36));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: `/tmp/achilias-signin-${width}-${path === "/" ? "home" : "login"}.png` });
    }
  }
  await page.goto(origin + "/forums/402/threads/902?demo=1");
  const posts = page.getByRole("region", { name: "Discussion posts" });
  await posts.locator("article").first().waitFor();
  assert.equal(await page.getByRole("button", { name: /Copy link to post/ }).count(), 0);
  assert.equal(await posts.locator('[data-post-kind="original"]').count(), 1);
  assert.equal(await posts.locator('[data-post-kind="reply"]').count(), 3);
  await page.getByRole("separator", { name: "Replies" }).waitFor();
  const first = await posts.locator('[data-post-kind="original"]').boundingBox();
  const reply = await posts.locator('[data-post-kind="reply"]').first().boundingBox();
  assert.ok(reply!.x > first!.x);
  assert.equal(await posts.locator('[data-post-kind="reply"]').first().evaluate((el) => getComputedStyle(el).borderLeftWidth), "2px");
  await posts.locator('[data-post-kind="reply"]').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/tmp/achilias-thread-replies-mobile.png" });
  await page.getByRole("textbox", { name: "Search posts on this page" }).fill("Jonas");
  await posts.locator("article").nth(1).waitFor({ state: "hidden" });
  assert.equal(await posts.locator('[data-post-kind="original"]').count(), 0);
  await page.getByRole("textbox", { name: "Search posts on this page" }).fill("");
  await page.setViewportSize({ width: 1501, height: 922 });
  await posts.locator('[data-post-kind="reply"]').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/tmp/achilias-thread-replies-desktop.png" });

  assert.equal((await page.request.patch(origin + "/api/preferences", {
    headers: { Origin: origin }, data: { readOnly: false },
  })).status(), 401);
  // A synthetic local session tests preference persistence without touching ILIAS.
  await saveSession({ id, instance: "https://ilias.example/", status: "connected", createdAt: Date.now() });
  await page.context().addCookies([{ name: SESSION_COOKIE, value: id, url: origin, httpOnly: true, sameSite: "Strict" }]);
  await page.goto(origin + "/settings");
  const toggle = page.getByRole("checkbox", { name: "Read-only mode", exact: true });
  await toggle.waitFor();
  assert.equal(await toggle.isChecked(), true);
  const headers = { Origin: origin, "x-achilias-connection": connection };
  assert.equal((await page.request.patch(origin + "/api/preferences", { headers: { ...headers, Origin: "https://other.example" }, data: { readOnly: false } })).status(), 403);
  assert.equal((await page.request.patch(origin + "/api/preferences", { headers: { ...headers, "x-achilias-connection": "stale" }, data: { readOnly: false } })).status(), 409);
  assert.equal((await page.request.patch(origin + "/api/preferences", { headers, data: { readOnly: "off" } })).status(), 400);
  await toggle.uncheck();
  await page.waitForFunction(() => {
    const input = document.querySelector<HTMLInputElement>('[aria-describedby="read-only-description"]');
    return input && !input.disabled && !input.checked;
  });
  const cookie = (await page.context().cookies()).find((cookie) => cookie.name === READ_ONLY_COOKIE);
  assert.equal(cookie?.value, "false");
  assert.equal(cookie?.httpOnly, true);
  const other = await browser.newContext();
  await other.addCookies([{ name: SESSION_COOKIE, value: id, url: origin, httpOnly: true, sameSite: "Strict" }]);
  assert.equal((await other.request.post(origin + "/api/forums/401/threads/601/read", { headers })).status(), 403,
    "Another browser should retain its own read-only default");
  await other.close();
  await page.reload();
  assert.equal(await toggle.isChecked(), false);
  await toggle.check();
  await page.waitForFunction(() => {
    const input = document.querySelector<HTMLInputElement>('[aria-describedby="read-only-description"]');
    return input && !input.disabled && input.checked;
  });
  // A client-supplied false cannot bypass the server's read-only cookie.
  const denied = await page.request.post(origin + "/api/forums/401/threads/601/read", { headers, data: { readOnly: false } });
  assert.equal(denied.status(), 403);
  assert.match((await denied.json()).error, /read-only preference/);
  await page.screenshot({ path: "/tmp/achilias-read-only-preferences.png" });
  console.log("Sign-in branding, forum hierarchy, preferences, origin/connection checks and server read-only enforcement passed");
} finally {
  await browser.close();
  await deleteSession(id);
}
