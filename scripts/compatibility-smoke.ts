import { chromium } from "playwright";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { saveSession, deleteSession, SESSION_COOKIE, type Session } from "../src/lib/ilias/session";

const origin = process.env.ACHILIAS_TEST_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", error => errors.push(error.message));
const sessions: Session[] = [0, 1].map(() => ({
  id: randomUUID(), instance: "https://ilias.example.edu/", createdAt: Date.now(),
  status: "connected", userName: "Compatibility example", iliasVersion: "11.0",
}));
const notice = page.getByRole("alert").filter({ hasText: "outside the development reference" });

async function connect(session: Session) {
  await saveSession(session);
  await context.addCookies([{ name: SESSION_COOKIE, value: session.id, url: origin, httpOnly: true }]);
  await page.goto(origin + "/settings");
  await page.getByRole("heading", { name: "Features & connection", exact: true }).waitFor();
}

try {
  await connect(sessions[0]);
  await notice.waitFor();
  assert.equal(await notice.getByRole("link", { name: "Open in ILIAS", exact: true }).getAttribute("href"), "https://ilias.example.edu/ilias.php?baseClass=ilDashboardGUI");
  await page.getByText("ILIAS version: 11.0", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Dismiss for this session", exact: true }).click();
  await notice.waitFor({ state: "hidden" });
  await page.goto(origin + "/saved");
  await page.getByRole("heading", { name: "Bookmarks", exact: true }).waitFor();
  assert.equal(await notice.count(), 0);
  await connect(sessions[1]);
  await notice.waitFor(); // Dismissal belongs to the original connection.
  sessions[0].iliasVersion = "12.0";
  await connect(sessions[0]);
  await notice.waitFor(); // An upgrade warrants a fresh notice.
  await page.getByText("ILIAS version: 12.0", { exact: true }).waitFor();
  sessions[0].iliasVersion = "10.6";
  await connect(sessions[0]);
  await page.getByText("ILIAS version: 10.6", { exact: true }).waitFor();
  assert.equal(await notice.count(), 0);
  sessions[0].iliasVersion = undefined;
  await connect(sessions[0]);
  await page.getByText("ILIAS version: Unknown", { exact: true }).waitFor();
  assert.equal(await notice.count(), 0);
  await page.goto(origin + "/settings?demo=1");
  await page.getByText("ILIAS version: No live server connected", { exact: true }).waitFor();
  assert.equal(await notice.count(), 0);
  assert.deepEqual(errors, []);
  console.log("Compatibility version display, notices, dismissal, account isolation and upgrades verified.");
} finally {
  await browser.close();
  await Promise.all(sessions.map(session => deleteSession(session.id)));
}
