import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const origin = process.env.ACHILIAS_TEST_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true });
const directory = await mkdtemp(path.join(tmpdir(), "achilias-helper-smoke-"));
const context = await browser.newContext();
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", (error) => errors.push(error.message));
async function openDialog() {
  await page
    .getByRole("button", { name: "Connect your ILIAS", exact: true })
    .click();
}
try {
  await page.goto(origin);
  await openDialog();
  await page
    .getByRole("button", { name: "Get a connection code", exact: true })
    .click();
  const codeField = page.getByRole("textbox", {
    name: "Connection code",
    exact: true,
  });
  await codeField.waitFor();
  const first = await codeField.inputValue();
  assert.match(first, /^[a-f0-9-]{36}\.[A-Za-z0-9_-]{43}$/);
  assert.equal(
    (await (await context.request.get(origin + "/api/session")).json()).status,
    "pending",
  );
  const helper = await browser.newContext();
  const endpoint = origin + "/api/connect/remote";
  const auth = { Authorization: `Bearer ${first}` };
  const metadata = await helper.request.get(endpoint, { headers: auth });
  assert.equal(metadata.status(), 200);
  assert.equal(
    (await metadata.json()).instance,
    "https://ilias.uni-freiburg.de/",
  );
  assert.equal(
    metadata.headers()["set-cookie"],
    undefined,
    "Helper metadata must not grant a browser session",
  );
  assert.equal((await helper.request.get(endpoint)).status(), 401);
  assert.equal(
    (
      await helper.request.get(endpoint, {
        headers: { ...auth, Origin: "https://other.example" },
      })
    ).status(),
    403,
  );
  assert.equal(
    (
      await helper.request.post(endpoint, {
        headers: auth,
        data: [
          {
            name: "SSO",
            value: "not-an-ilias-cookie",
            domain: "mylogin.uni-freiburg.de",
          },
        ],
      })
    ).status(),
    400,
  );
  await page.reload();
  await openDialog();
  await page
    .getByRole("button", {
      name: "Generate a new connection code",
      exact: true,
    })
    .click();
  await codeField.waitFor();
  const replacement = await codeField.inputValue();
  assert.notEqual(replacement, first);
  assert.equal(
    (await helper.request.get(endpoint, { headers: auth })).status(),
    401,
    "Reissued code left old code active",
  );
  const cookieFile = path.join(directory, "cookies.json");
  await writeFile(
    cookieFile,
    JSON.stringify([
      {
        name: "PHPSESSID",
        value: "deliberately-unauthenticated",
        domain: "ilias.uni-freiburg.de",
        path: "/",
        secure: true,
        httpOnly: true,
      },
    ]),
    { mode: 0o600 },
  );
  const laptopData = path.join(directory, "laptop-data");
  const proc = Bun.spawn(
    [
      process.execPath,
      "scripts/connect.ts",
      "--server",
      origin,
      "--cookies",
      cookieFile,
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DISPLAY: "",
        WAYLAND_DISPLAY: "",
        ACHILIAS_DATA_DIR: laptopData,
      },
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  proc.stdin.write(replacement + "\n");
  proc.stdin.end();
  const [output, stderr, exit] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  assert.equal(exit, 1, "Fake ILIAS session should be rejected by the server");
  assert.match(stderr, /server could not verify this ILIAS session/i);
  assert.ok(
    !output.includes(replacement) && !stderr.includes(replacement),
    "Helper printed its bearer code",
  );
  assert.deepEqual(
    await readdir(laptopData).catch(() => []),
    [],
    "Remote helper wrote a local server session",
  );
  assert.equal(
    (await (await context.request.get(origin + "/api/session")).json()).status,
    "pending",
    "Unverified upload connected an account",
  );
  await page
    .getByRole("button", { name: "Cancel sign-in", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Get a connection code", exact: true })
    .waitFor();
  assert.equal(
    (
      await helper.request.get(endpoint, {
        headers: { Authorization: `Bearer ${replacement}` },
      })
    ).status(),
    401,
  );
  assert.equal(
    (await (await context.request.get(origin + "/api/session")).json()).status,
    "disconnected",
  );
  assert.deepEqual(errors, []);
  console.log(
    "Passed: headless pairing UI, code scoping/reissue/cancellation, bearer authorization, origin checks, IdP-cookie rejection, laptop CLI over stdin without a browser/shared filesystem, and server-side rejection of an unauthenticated session.",
  );
} finally {
  await context.request
    .delete(origin + "/api/session", { headers: { Origin: origin } })
    .catch(() => {});
  await browser.close();
  await rm(directory, { recursive: true });
}
