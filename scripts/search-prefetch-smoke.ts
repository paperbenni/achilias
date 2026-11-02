import { chromium } from "playwright";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { saveSession, deleteSession, SESSION_COOKIE } from "../src/lib/ilias/session";
import type { Item } from "../src/lib/ilias/types";
const origin = process.env.ACHILIAS_TEST_URL || "http://127.0.0.1:3001";
const id = randomUUID();
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin + "/settings?demo=1");
  await page.getByRole("button", { name: "Quick search", exact: true }).click();
  const beforeHover: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/browse/grp/601" && url.searchParams.has("_rsc")) beforeHover.push(request.url());
  });
  await page.getByRole("combobox").fill("Gruppe 02");
  const result = page.getByRole("option", { name: /Gruppe 02 Introduction to Computer Science/ });
  await result.waitFor();
  assert.equal(beforeHover.length, 0, "Merely showing a result must not prefetch it");
  const loaded = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/browse/grp/601" && url.searchParams.has("_rsc") && response.request().headers()["next-router-segment-prefetch"] !== "/_tree";
  });
  await result.hover();
  assert.equal((await loaded).status(), 200);
  await page.waitForLoadState("networkidle");
  const requests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/browse/grp/601" && url.searchParams.has("_rsc") && request.headers()["next-router-segment-prefetch"] !== "/_tree") requests.push(request.url());
  });
  await result.click();
  await page.getByRole("heading", { name: "Gruppe 02", exact: true }).waitFor();
  assert.equal(requests.length, 0, "Click must reuse the complete prefetched route");
  // The asChild link must retain cmdk's keyboard selection and navigation.
  await page.getByRole("button", { name: "Quick search", exact: true }).click();
  await page.getByRole("combobox").fill("Gruppe 02");
  await page.getByRole("option", { name: /Gruppe 02 Linear Algebra/ }).waitFor();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForURL("**/browse/grp/602?demo=1");

  // Live forum reads and downloads are excluded from speculative navigation.
  await saveSession({ id, instance: "https://campus.example/", status: "connected", createdAt: Date.now() });
  const context = await browser.newContext();
  await context.addCookies([{ name: SESSION_COOKIE, value: id, url: origin, httpOnly: true, sameSite: "Strict" }]);
  const live = await context.newPage();
  live.on("pageerror", (error) => errors.push(error.message));
  const entries: Item[] = ["frm", "file", "tst", "fold"].map((type, index) => ({
    id: String(950 + index), type, title: `Hover exclusion ${type}`, description: "", meta: "", available: type !== "fold", sourceUrl: `https://campus.example/goto.php?target=${type}_${950 + index}`,
  }));
  await live.route("**/api/search/items", (route) => route.fulfill({ json: { items: entries, hasMore: false } }));
  await live.route("**/api/search/nearby?*", (route) => route.fulfill({ contentType: "application/x-ndjson", body: '{"items":[]}\n' }));
  await live.route("**/api/search?*", (route) => route.fulfill({ json: { results: [], hasMore: false, page: 1 } }));
  await live.goto(origin + "/settings");
  await live.getByRole("button", { name: "Quick search", exact: true }).click();
  await live.getByRole("combobox").fill("Hover exclusion");
  const excludedRequests: string[] = [];
  live.on("request", (request) => {
    if (/\/(?:forums|browse|api\/files)\//.test(new URL(request.url()).pathname)) excludedRequests.push(request.url());
  });
  for (const entry of entries) await live.getByRole("option", { name: new RegExp(entry.title) }).hover();
  await live.waitForLoadState("networkidle");
  assert.deepEqual(excludedRequests, [], "Excluded results must not issue speculative requests");
  assert.deepEqual(errors, []);
  console.log("Search hover prefetch passed: result loads before selection and click reuses the prefetched page.");
} finally { await browser.close(); await deleteSession(id); }
