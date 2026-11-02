import { chromium } from "playwright";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  saveSession,
  deleteSession,
  SESSION_COOKIE,
} from "../src/lib/ilias/session";
const origin = process.env.ACHILIAS_TEST_URL || "http://127.0.0.1:3001";
const browser = await chromium.launch({ headless: true });
const ids = [randomUUID(), randomUUID()];
const instances = [
  "https://ilias.uni-freiburg.de/",
  "https://courses.example-university.edu/ilias/",
];
const contexts = await Promise.all(ids.map(() => browser.newContext()));
const errors: string[] = [];
try {
  for (const [index, id] of ids.entries()) {
    await saveSession({
      id,
      instance: instances[index],
      createdAt: Date.now(),
      status: "connected",
      userName: `Synthetic user ${index}`,
    });
    await contexts[index].addCookies([
      {
        name: SESSION_COOKIE,
        value: id,
        url: origin,
        httpOnly: true,
        sameSite: "Strict",
      },
    ]);
  }
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  for (const page of pages)
    page.on("pageerror", (error) => errors.push(error.message));
  await Promise.all(pages.map((page) => page.goto(origin + "/settings")));
  for (const [index, page] of pages.entries()) {
    await page
      .getByRole("heading", {
        name: "A clear view of what’s here.",
        exact: true,
      })
      .waitFor();
    await page.getByText(instances[index], { exact: true }).waitFor();
    assert.equal(
      await page.getByText(instances[1 - index], { exact: true }).count(),
      0,
    );
    const response = await contexts[index].request.get(origin + "/settings");
    assert.match(response.headers()["cache-control"], /private.*no-store/);
    assert.equal(
      (
        await (
          await contexts[index].request.get(origin + "/api/session")
        ).json()
      ).status,
      "connected",
    );
  }
  // Logging A out cannot revoke B or change B's cached personal page.
  assert.equal(
    (
      await contexts[0].request.delete(origin + "/api/session", {
        headers: { Origin: origin },
      })
    ).status(),
    200,
  );
  assert.equal(
    (await (await contexts[0].request.get(origin + "/api/session")).json())
      .status,
    "disconnected",
  );
  assert.equal(
    (await (await contexts[1].request.get(origin + "/api/session")).json())
      .status,
    "connected",
  );
  await pages[1].reload();
  await pages[1].getByText(instances[1], { exact: true }).waitFor();
  // User-selected instances work, and a private host is rejected before sign-in.
  const start = await contexts[0].request.post(origin + "/api/connect", {
    headers: { Origin: origin },
    data: { instance: instances[1], mode: "remote" },
  });
  assert.equal(start.status(), 200);
  const pending = await start.json();
  const metadata = await contexts[0].request.get(
    origin + "/api/connect/remote",
    { headers: { Authorization: `Bearer ${pending.code}` } },
  );
  assert.equal((await metadata.json()).instance, instances[1]);
  const privateHost = await contexts[0].request.post(origin + "/api/connect", {
    headers: { Origin: origin },
    data: { instance: "https://127.0.0.1/", mode: "remote" },
  });
  assert.equal(privateHost.status(), 400);
  // A bad connection attempt must not disconnect the other user.
  assert.equal(
    (await (await contexts[1].request.get(origin + "/api/session")).json())
      .status,
    "connected",
  );
  assert.deepEqual(errors, []);
  console.log(
    "Passed: separate browser sessions and instance settings, private/no-store pages, independent logout, custom-instance pairing, and private-host rejection.",
  );
} finally {
  for (const context of contexts)
    await context.request
      .delete(origin + "/api/session", { headers: { Origin: origin } })
      .catch(() => {});
  await Promise.all(ids.map(deleteSession));
  await browser.close();
}
