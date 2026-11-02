import { chromium } from "playwright";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { saveSession, deleteSession, SESSION_COOKIE } from "../src/lib/ilias/session";
import type { Item } from "../src/lib/ilias/types";

const origin = process.env.ACHILIAS_TEST_URL || "http://127.0.0.1:3001";
const id = randomUUID();
const browser = await chromium.launch({ headless: true });
const group: Item = { id: "304", type: "fold", title: "Gruppe 04", context: "Vorlesung › Tutorate", description: "", meta: "", available: true, sourceUrl: "https://campus.example/goto.php?target=fold_304" };
try {
  await saveSession({ id, instance: "https://campus.example/", createdAt: Date.now(), status: "connected" });
  const context = await browser.newContext();
  await context.addCookies([{ name: SESSION_COOKIE, value: id, url: origin, httpOnly: true, sameSite: "Strict" }]);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Exercise the real live-mode UI without sending any requests to a university.
  await page.addInitScript(() => {
    const original = window.fetch;
    const state = window as unknown as {
      emitNearby: (items: unknown[]) => void; finishNearby: () => void;
      nearbyRequests: number;
    };
    state.nearbyRequests = 0;
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith("/api/search/nearby")) {
        state.nearbyRequests++;
        const encoder = new TextEncoder();
        return new Response(new ReadableStream({ start(controller) {
          state.emitNearby = (items) => controller.enqueue(encoder.encode(JSON.stringify({ items }) + "\n"));
          state.finishNearby = () => controller.close();
          state.emitNearby([]);
        } }), { headers: { "Content-Type": "application/x-ndjson" } });
      }
      return original(input, init);
    }) as typeof window.fetch;
  });
  await page.route("**/api/search/items", (route) => route.fulfill({ json: { items: [], discovered: [], hasMore: false } }));
  let releaseGlobal!: () => void;
  const heldGlobal = new Promise<void>((resolve) => { releaseGlobal = resolve; });
  let globalStarted!: () => void;
  const started = new Promise<void>((resolve) => { globalStarted = resolve; });
  let globalFinished = false;
  await page.route("**/api/search?*", async (route) => {
    globalStarted();
    await heldGlobal;
    globalFinished = true;
    await route.fulfill({ json: { results: [], page: 1, hasMore: false } });
  });
  // Settings loads account metadata without an upstream page request.
  await page.goto(origin + "/settings");
  await page.getByRole("button", { name: "Quick search", exact: true }).click();
  await page.getByRole("combobox").fill("Gruppe 04");
  await started;
  const before = performance.now();
  await page.evaluate((item) => (window as unknown as { emitNearby: (items: Item[]) => void }).emitNearby([item]), group);
  await page.getByRole("option", { name: /Gruppe 04/ }).waitFor();
  assert.equal(globalFinished, false, "nearby result must be visible while global search is still blocked");
  const streamedMs = Math.round(performance.now() - before);
  await page.getByRole("combobox").fill("Gruppe");
  await page.getByRole("option", { name: /Gruppe 04/ }).waitFor();
  assert.equal(await page.evaluate(() => (window as unknown as { nearbyRequests: number }).nearbyRequests), 1, "typing must reuse discovery rather than start another crawl");
  await page.evaluate(() => (window as unknown as { finishNearby: () => void }).finishNearby());
  releaseGlobal();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Quick search", exact: true }).click();
  await page.getByRole("combobox").fill("Gruppe 04");
  await page.getByRole("option", { name: /Gruppe 04/ }).waitFor();
  assert.deepEqual(errors, []);
  console.log(`Search discovery passed: streamed result visible in ${streamedMs}ms while global search was blocked; reused across typing and reopening.`);
} finally {
  await browser.close();
  await deleteSession(id);
}
