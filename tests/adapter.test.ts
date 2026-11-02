import { afterEach, describe, expect, mock, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { parsePage } from "../src/lib/ilias/parser";
import {
  assertInstance,
  FREIBURG,
  normalizeInstance,
  objectUrl,
  upstreamUrl,
} from "../src/lib/ilias/config";
import { CookieJar } from "tough-cookie";
import { fetchPage, fetchUpstream } from "../src/lib/ilias/client";
import type { Session } from "../src/lib/ilias/session";
import { newPairing, verifyPairing } from "../src/lib/ilias/pairing";
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const fixture = (name: string) =>
  readFile(new URL(`./fixtures/${name}.html`, import.meta.url), "utf8");
function session(): Session {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    instance: FREIBURG,
    status: "pending",
    createdAt: Date.now(),
  };
}

describe("ILIAS 10 template adapter", () => {
  test("reads list items, retains unsupported and restricted objects, and flags pagination", async () => {
    const page = parsePage(
      await fixture("container"),
      FREIBURG + "ilias.php?ref_id=12",
    );
    expect(page.authenticated).toBe(true);
    expect(
      page.items.map((item) => [item.id, item.type, item.available]),
    ).toEqual([
      ["41", "fold", true],
      ["42", "file", true],
      ["43", "exc", true],
      ["44", "tst", false],
      ["45", "unknown", false],
    ]);
    expect(page.items[0].description).toBe("Slides & reading");
    expect(page.text).toEqual(["Welcome to Algorithms."]);
    expect(page.tools.map((t) => t.title)).toEqual(["Content", "Info"]);
    expect(page.hasMore).toBe(true);
    expect(page.items[4].sourceUrl).not.toContain("javascript:");
  });
  test("reads repository cards and standard items on the dashboard", async () => {
    const page = parsePage(
      await fixture("dashboard"),
      FREIBURG + "ilias.php?baseClass=ilDashboardGUI",
    );
    expect(page.items.map((i) => [i.type, i.id, i.title])).toEqual([
      ["crs", "12", "Algorithms"],
      ["grp", "13", "Study group"],
    ]);
    expect(page.authenticated).toBe(true);
  });
  test("does not mistake a public page or login form for a signed-in session", () => {
    expect(parsePage("<h1>Public course</h1>", FREIBURG).authenticated).toBe(
      false,
    );
    expect(
      parsePage(
        '<a href="logout.php">Logout</a><form action="./shib_login.php"></form>',
        FREIBURG,
      ).authenticated,
    ).toBe(false);
  });
  test("does not duplicate nested container wrappers", () => {
    const html =
      '<div class="ilContainerListItemOuter" id="lg_div_12"><div class="ilContainerListItem"><h3><a class="il_ContainerItemTitle" href="goto.php?target=crs_12">Course</a></h3></div></div>';
    expect(parsePage(html, FREIBURG).items).toHaveLength(1);
  });
});
describe("instance and credential boundaries", () => {
  test("normalizes installation paths and only accepts configured instances", () => {
    expect(normalizeInstance("https://example.edu/ilias/login.php?x=1")).toBe(
      "https://example.edu/ilias/",
    );
    expect(assertInstance(FREIBURG)).toBe(FREIBURG);
    expect(() => assertInstance("https://unconfigured.example/")).toThrow();
    for (const target of [
      "http://example.edu",
      "https://user:password@example.edu",
      "https://example.edu:8443",
    ])
      expect(() => normalizeInstance(target)).toThrow();
  });
  test("rejects cross-origin redirects, credentials, and escapes from a subdirectory", () => {
    for (const target of [
      "https://other.example/file",
      "//other.example/file",
      "https://user:pass@ilias.uni-freiburg.de/",
    ])
      expect(() => upstreamUrl(FREIBURG, target)).toThrow();
    expect(() =>
      upstreamUrl("https://example.edu/ilias/", "../private"),
    ).toThrow();
    expect(() => objectUrl(FREIBURG, "file", "../42")).toThrow();
  });
  test("never follows an SSO redirect with the ILIAS cookies", async () => {
    const jar = new CookieJar();
    await jar.setCookie("PHPSESSID=test-secret; Secure; Path=/", FREIBURG);
    const s = session();
    s.jar = jar.serializeSync();
    const requests: string[] = [];
    globalThis.fetch = mock(async (url: Parameters<typeof fetch>[0]) => {
      requests.push(String(url));
      return new Response(null, {
        status: 302,
        headers: { location: "https://mylogin.uni-freiburg.de/login" },
      });
    }) as unknown as typeof fetch;
    await expect(fetchUpstream(s, "ilias.php")).rejects.toMatchObject({
      status: 401,
    });
    expect(requests).toEqual([FREIBURG + "ilias.php"]);
  });
  test("carries cookie rotation across same-origin redirects", async () => {
    const calls: { url: string; cookie: string }[] = [];
    globalThis.fetch = mock(
      async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
        calls.push({
          url: String(url),
          cookie: (init?.headers as Record<string, string>).Cookie,
        });
        return calls.length === 1
          ? new Response(null, {
              status: 302,
              headers: {
                location: "ilias.php?next=1",
                "set-cookie": "PHPSESSID=rotated; Secure; Path=/",
              },
            })
          : new Response(await fixture("dashboard"), {
              headers: { "content-type": "text/html" },
            });
      },
    ) as unknown as typeof fetch;
    const page = await fetchPage(session(), "ilias.php");
    expect(calls[1].cookie).toContain("PHPSESSID=rotated");
    expect(page.items).toHaveLength(2);
  });
  test("returns a session-expired error rather than treating a login page as empty content", async () => {
    globalThis.fetch = mock(
      async () =>
        new Response('<h1>Login</h1><form action="shib_login.php"></form>', {
          headers: { "content-type": "text/html" },
        }),
    ) as unknown as typeof fetch;
    await expect(fetchPage(session(), "ilias.php")).rejects.toMatchObject({
      status: 401,
    });
  });
  test("pairing expires and does not accept a modified secret", () => {
    const p = newPairing();
    expect(verifyPairing(p.secret, p.digest, p.expiresAt)).toBe(true);
    expect(verifyPairing(p.secret + "x", p.digest, p.expiresAt)).toBe(false);
    expect(verifyPairing(p.secret, p.digest, Date.now() - 1)).toBe(false);
  });
});
