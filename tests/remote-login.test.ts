import { expect, mock, test, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { importInstanceCookies } from "../src/lib/ilias/cookie-import";
import { remoteServerUrl, remoteRequest } from "../src/lib/ilias/remote-client";
import { serverLoginMode } from "../src/lib/ilias/login";
import { readRemotePayload } from "../src/lib/ilias/remote-login";
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
test("remote transfers verify accounts, filter IdP cookies, expire, reject replay and survive cancellation", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "achilias-remote-test-"));
  try {
    const proc = Bun.spawn(
      [process.execPath, "tests/helpers/remote-session.ts"],
      {
        cwd: process.cwd(),
        env: { ...process.env, ACHILIAS_DATA_DIR: dir },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [output, error, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    expect(error).toBe("");
    expect(code).toBe(0);
    expect(output.trim()).toBe("verified");
  } finally {
    await rm(dir, { recursive: true });
  }
});
test("cookie imports are limited to the ILIAS host and reject malformed names and paths", async () => {
  const instance = "https://ilias.uni-freiburg.de/";
  const jar = await importInstanceCookies(
    [
      {
        name: "PHPSESSID",
        value: "example",
        domain: "ilias.uni-freiburg.de",
        path: "/",
      },
      {
        name: "SSO",
        value: "private-idp-value",
        domain: ".uni-freiburg.de",
        path: "/",
      },
    ],
    instance,
  );
  expect(JSON.stringify(jar)).not.toContain("private-idp-value");
  await expect(
    importInstanceCookies(
      [{ name: "a", value: "b", domain: "other.example" }],
      instance,
    ),
  ).rejects.toThrow("No cookies");
  await expect(
    importInstanceCookies(
      [
        {
          name: "a",
          value: "b",
          domain: "ilias.uni-freiburg.de",
          path: "/; Domain=other.example",
        },
      ],
      instance,
    ),
  ).rejects.toThrow();
  await expect(
    importInstanceCookies(
      [{ name: "bad=name", value: "b", domain: "ilias.uni-freiburg.de" }],
      instance,
    ),
  ).rejects.toThrow();
});
test("remote URLs allow HTTPS and loopback tunnels but reject plaintext remote hosts and embedded credentials", () => {
  expect(remoteServerUrl("https://achilias.example")).toBe(
    "https://achilias.example",
  );
  expect(remoteServerUrl("http://127.0.0.1:3000")).toBe(
    "http://127.0.0.1:3000",
  );
  for (const value of [
    "http://remote.example",
    "https://user:secret@remote.example",
    "https://remote.example/other",
    "https://remote.example/?token=private",
    "file:///tmp/app",
  ])
    expect(() => remoteServerUrl(value)).toThrow();
});
test("helper bearer codes are sent in a header and transfers refuse redirects", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = mock(async (input, init) => {
    calls.push({ url: String(input), init });
    return Response.json({ status: "connected" });
  }) as unknown as typeof fetch;
  const code = "12345678-1234-1234-1234-123456789012." + "x".repeat(43);
  await remoteRequest("https://achilias.example", code, [{ name: "example" }]);
  expect(calls[0].url).not.toContain(code);
  expect(calls[0].init?.redirect).toBe("error");
  expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe(
    `Bearer ${code}`,
  );
});
test("remote upload body is size limited before JSON parsing", async () => {
  await expect(
    readRemotePayload(
      new Request("https://app.example/api", {
        method: "POST",
        body: "x".repeat(256 * 1024 + 1),
      }),
    ),
  ).rejects.toMatchObject({ status: 413 });
  await expect(
    readRemotePayload(
      new Request("https://app.example/api", {
        method: "POST",
        body: "not-json",
      }),
    ),
  ).rejects.toMatchObject({ status: 400 });
});

test("headless servers select the laptop helper and respect an explicit login mode", () => {
  const previous = {
    mode: process.env.ACHILIAS_LOGIN_MODE,
    display: process.env.DISPLAY,
    wayland: process.env.WAYLAND_DISPLAY,
  };
  try {
    process.env.ACHILIAS_LOGIN_MODE = "remote";
    expect(serverLoginMode()).toBe("remote");
    process.env.ACHILIAS_LOGIN_MODE = "local";
    expect(serverLoginMode()).toBe("local");
    delete process.env.ACHILIAS_LOGIN_MODE;
    delete process.env.DISPLAY;
    delete process.env.WAYLAND_DISPLAY;
    if (process.platform === "linux") expect(serverLoginMode()).toBe("remote");
  } finally {
    for (const [key, value] of [
      ["ACHILIAS_LOGIN_MODE", previous.mode],
      ["DISPLAY", previous.display],
      ["WAYLAND_DISPLAY", previous.wayland],
    ]) {
      if (value === undefined) delete process.env[key!];
      else process.env[key!] = value;
    }
  }
});
