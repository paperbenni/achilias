import { chromium } from "playwright";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { newPairing } from "../src/lib/ilias/pairing";
import { saveSession, deleteSession } from "../src/lib/ilias/session";
const origin = process.env.ACHILIAS_TEST_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true });
const errors: string[] = [];
const testSessionId = randomUUID();
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin);
  await page
    .getByRole("heading", { name: "Less friction. More learning." })
    .waitFor();
  await page.getByRole("link", { name: "Take a look around" }).click();
  await page.getByRole("heading", { name: "Overview" }).waitFor();
  assert.equal(
    await page
      .getByText("A LITTLE LESS SEARCHING. A LITTLE MORE LEARNING.", {
        exact: true,
      })
      .count(),
    0,
  );
  assert.equal(
    await page.getByText("A LITTLE MORE CLARITY", { exact: true }).count(),
    0,
  );
  await page.getByRole("button", { name: "HTML-based", exact: true }).click();
  await page
    .getByText(
      "ILIAS or theme updates can make this feature incomplete or incorrect.",
      { exact: false },
    )
    .waitFor();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", {
      name: "Details for Introduction to Computer Science",
      exact: true,
    })
    .hover();
  await page
    .getByRole("tooltip")
    .filter({ hasText: "Winter semester" })
    .waitFor();
  const hci = page.locator(".course-card").filter({
    has: page.getByRole("link", {
      name: "Human–Computer Interaction",
      exact: true,
    }),
  });
  // The description belongs to the card's primary link, not only its title.
  const body = await hci.locator('[data-slot="card-content"]').boundingBox();
  assert.ok(body);
  const point = { x: body.x + 24, y: body.y + 16 };
  const hit = await page.evaluate(
    ({ x, y }) =>
      document.elementFromPoint(x, y)?.closest("a")?.getAttribute("href"),
    point,
  );
  assert.equal(hit, "/browse/crs/103?demo=1");
  await page.mouse.click(point.x, point.y);
  await page
    .getByRole("heading", { name: "Human–Computer Interaction", exact: true })
    .waitFor();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page.getByRole("heading", { name: "Overview", exact: true }).waitFor();

  await page
    .getByRole("button", { name: "Save Linear Algebra I", exact: true })
    .click();
  assert.equal(
    new URL(page.url()).pathname,
    "/",
    "Bookmark click navigated the card",
  );
  await page
    .getByRole("link", { name: "Saved for later", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Saved for later.", exact: true })
    .waitFor();
  await page
    .getByRole("link", { name: "Linear Algebra I", exact: true })
    .waitFor();
  await page.reload();
  await page
    .getByRole("link", { name: "Linear Algebra I", exact: true })
    .waitFor();
  // A second tab must update the already-mounted Saved screen immediately.
  const otherTab = await context.newPage();
  await otherTab.goto(origin + "/?demo=1");
  await otherTab
    .getByRole("button", { name: "Unsave Linear Algebra I", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Linear Algebra I", exact: true })
    .waitFor({ state: "hidden" });
  await otherTab
    .getByRole("button", { name: "Save Linear Algebra I", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Linear Algebra I", exact: true })
    .waitFor();
  await otherTab.close();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page.getByRole("heading", { name: "Overview", exact: true }).waitFor();
  await page
    .getByRole("textbox", { name: "Filter courses and materials" })
    .fill("interaction");
  assert.equal(await page.locator(".course-card").count(), 1);
  await page
    .getByRole("textbox", { name: "Filter courses and materials" })
    .fill("");
  await page.getByRole("radio", { name: "List view" }).click();
  assert.equal(await page.locator(".resource-row").count(), 4);
  await page.getByRole("link", { name: "My courses", exact: true }).click();
  await page.getByRole("heading", { name: "Your courses.", exact: true }).waitFor();
  assert.equal(await page.locator(".course-card").count(), 4);
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page.getByRole("heading", { name: "Overview", exact: true }).waitFor();
  await page
    .getByRole("link", {
      name: "Introduction to Computer Science",
      exact: true,
    })
    .click();
  await page.getByRole("tab", { name: "Course information" }).click();
  await page.getByText("Office hours: Tuesdays", { exact: false }).waitFor();
  await page.getByRole("tab", { name: "ILIAS tools" }).click();
  await page.getByRole("link", { name: "Members", exact: false }).waitFor();
  await page.getByRole("tab", { name: "Materials 5" }).click();
  await page
    .getByRole("button", { name: "Check your understanding", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Visit ILIAS" })
    .waitFor();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("link", { name: "Lecture materials", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Lecture materials", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "01 — Getting started.pdf", exact: true })
    .click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download example PDF" }).click();
  const download = await downloaded;
  assert.equal(download.suggestedFilename(), "achilias-example.pdf");
  assert.equal(await download.failure(), null);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill("linear");
  await page.getByRole("option", { name: /Linear Algebra I/ }).click();
  await page
    .getByRole("heading", { name: "Linear Algebra I", exact: true })
    .waitFor();
  // Deep search goes through ILIAS' repository search and shows course paths.
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill("gruppe");
  await page
    .getByRole("option", { name: /Search all your courses/ })
    .click();
  await page
    .getByText("Introduction to Computer Science › Exercise groups")
    .waitFor();
  assert.equal(
    await page.getByRole("option", { name: /Gruppe 02/ }).count(),
    3,
    "Duplicate group names should be distinguishable by course path",
  );
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await page
    .getByRole("link", { name: "Saved for later", exact: true })
    .click();
  await page.getByRole("heading", { name: "Saved for later." }).waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
    "Mobile layout overflows",
  );
  await page.goto(origin + "/settings?demo=1");
  await page
    .getByRole("heading", { name: "A clear view of what’s here." })
    .waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
    "Settings overflows on mobile",
  );
  const invalid = await page.request.post(origin + "/api/connect", {
    headers: { Origin: "https://other.example" },
    data: { instance: "https://ilias.uni-freiburg.de/" },
  });
  assert.equal(invalid.status(), 400);
  const unauth = await page.request.get(origin + "/api/files/123");
  assert.equal(unauth.status(), 401);
  const pairing = await page.request.post(origin + "/api/session/import", {
    headers: { Origin: origin },
    data: { token: "invalid" },
  });
  assert.equal(pairing.status(), 400);
  const claim = newPairing();
  await saveSession({
    id: testSessionId,
    instance: "https://ilias.uni-freiburg.de/",
    createdAt: Date.now(),
    status: "connected",
    pairing: { digest: claim.digest, expiresAt: claim.expiresAt },
  });
  const token = `${testSessionId}.${claim.secret}`;
  // Exercise the actual fragment-to-POST pairing flow without a real account.
  await page.goto(`${origin}/connect#${token}`);
  await page.waitForURL(origin + "/");
  assert.equal(new URL(page.url()).hash, "");
  const connected = await page.request.get(origin + "/api/session");
  assert.equal((await connected.json()).status, "connected");
  const replay = await page.request.post(origin + "/api/session/import", {
    headers: { Origin: origin },
    data: { token },
  });
  assert.equal(
    replay.status(),
    400,
    "One-time connection link was accepted twice",
  );
  // The deliberately credential-free session must produce a useful expiry state.
  const parserNotice = page.getByRole("note", {
    name: "Course listings: HTML-based feature",
    exact: true,
  });
  await parserNotice.waitFor();
  const sourceLink = parserNotice.getByRole("link", {
    name: "Open original in ILIAS",
    exact: true,
  });
  assert.equal(
    await sourceLink.getAttribute("href"),
    "https://ilias.uni-freiburg.de/ilias.php?baseClass=ilDashboardGUI",
  );
  assert.equal(await sourceLink.getAttribute("target"), "_blank");
  await page
    .getByText("Couldn’t load this learning space", { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Reconnect account", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Connect your learning space", exact: true })
    .waitFor();
  await page.waitForTimeout(2200);
  assert.equal(
    await page.getByRole("dialog").count(),
    1,
    "Reconnect dialog closed because an old local session exists",
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  const disconnected = await page.request.delete(origin + "/api/session", {
    headers: { Origin: origin },
  });
  assert.equal(disconnected.status(), 200);
  assert.equal(
    (await (await page.request.get(origin + "/api/session")).json()).status,
    "disconnected",
  );
  assert.deepEqual(errors, []);
  console.log(
    "Passed: onboarding, navigation, saved-item persistence and cross-tab synchronization, filtering, list view, course tabs, activity handoff, folders, PDF download, quick search, mobile navigation/layout, API origin checks, unauthenticated download, invalid pairing, one-time connection claim, expired-session state, reconnect dialog, disconnect.",
  );
} finally {
  await deleteSession(testSessionId);
  await browser.close();
}
