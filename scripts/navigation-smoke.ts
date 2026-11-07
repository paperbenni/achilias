import { chromium } from "playwright";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { saveSession, deleteSession } from "../src/lib/ilias/session";
import { newPairing } from "../src/lib/ilias/pairing";
// Production preview: run against `next start` on port 3001.
const origin = process.env.ACHILIAS_TEST_URL || "http://127.0.0.1:3001";
const browser = await chromium.launch({ headless: true });
const id = randomUUID();
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin + "/?demo=1");
  await page.getByRole("heading", { name: "Overview", exact: true }).waitFor();
  // Hover prioritizes this Link in Next's production prefetch queue.
  await page
    .getByRole("link", {
      name: "Introduction to Computer Science",
      exact: true,
    })
    .hover();
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    (window as typeof window & { documentMarker?: boolean }).documentMarker =
      true;
  });
  const requests: string[] = [];
  page.on("request", (request) => {
    if (
      new URL(request.url()).searchParams.has("_rsc") &&
      request.headers()["next-router-segment-prefetch"] !== "/_tree"
    )
      requests.push(new URL(request.url()).pathname);
  });
  await page
    .getByRole("link", {
      name: "Introduction to Computer Science",
      exact: true,
    })
    .click();
  await page
    .getByRole("heading", {
      name: "Introduction to Computer Science",
      exact: true,
    })
    .waitFor();
  assert.equal(
    requests.filter((path) => path === "/browse/crs/101").length,
    0,
    "Prefetched course was requested again on click",
  );
  assert.equal(
    await page.evaluate(
      () =>
        (window as typeof window & { documentMarker?: boolean }).documentMarker,
    ),
    true,
    "Ordinary navigation reloaded the document",
  );
  const refreshed = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      !!response.request().headers()["next-action"],
  );
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  assert.equal((await refreshed).status(), 200);
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll("button")).some(
      (button) => button.textContent?.trim() === "Refresh" && !button.disabled,
    ),
  );
  await context.close();
  // A locally created, credential-free account is sufficient for session-only
  // pages. Warming these pages must not require an actual ILIAS sign-in.
  const account = await browser.newContext();
  const app = await account.newPage();
  const backgroundSources: string[] = [];
  app.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.searchParams.has("_rsc") &&
      (url.pathname === "/" ||
        url.pathname.startsWith("/browse/") ||
        url.pathname.startsWith("/forums/"))
    )
      backgroundSources.push(url.pathname);
  });
  const pairing = newPairing();
  await saveSession({
    id,
    instance: "https://ilias.uni-freiburg.de/",
    status: "connected",
    createdAt: Date.now(),
    userName: "Cached example account",
    pairing: { digest: pairing.digest, expiresAt: pairing.expiresAt },
  });
  const claim = await account.request.post(origin + "/api/session/import", {
    headers: { Origin: origin },
    data: { token: `${id}.${pairing.secret}` },
  });
  assert.equal(claim.status(), 200);
  await app.goto(origin + "/settings");
  await app
    .getByRole("heading", { name: "Features & connection", exact: true })
    .waitFor();
  await app.getByRole("button", { name: /Cached example account/ }).waitFor();
  await app.getByRole("link", { name: "Bookmarks", exact: true }).click();
  await app.getByRole("heading", { name: "Bookmarks", exact: true }).waitFor();
  await app.evaluate(() => {
    (window as typeof window & { documentMarker?: boolean }).documentMarker =
      true;
  });
  await app.getByRole("button", { name: /Cached example account/ }).click();
  await app
    .getByRole("menuitem", { name: "Disconnect account", exact: true })
    .click();
  await app
    .getByRole("heading", {
      name: "Connect to ILIAS",
      exact: true,
    })
    .waitFor();
  assert.equal(
    await app.evaluate(
      () =>
        (window as typeof window & { documentMarker?: boolean }).documentMarker,
    ),
    undefined,
    "Disconnect did not clear the document/router cache",
  );
  await app
    .getByRole("link", { name: "Features & connection", exact: true })
    .click();
  await app
    .getByRole("heading", { name: "Features & connection", exact: true })
    .waitFor();
  assert.equal(
    await app.getByRole("button", { name: /Cached example account/ }).count(),
    0,
    "Previous account survived in a prefetched page",
  );
  assert.deepEqual(errors, []);
  console.log(
    "Passed: production course prefetch, zero destination requests on warm click, client-side navigation, refresh action, metadata-only pages, and cache clearing on disconnect.",
  );
} finally {
  await deleteSession(id);
  await browser.close();
}
