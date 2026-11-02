import { upstreamTransport } from "../src/lib/ilias/upstream-transport";
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
import { requireSameOrigin, type Session } from "../src/lib/ilias/session";
import { newPairing, verifyPairing } from "../src/lib/ilias/pairing";
const originalFetch = upstreamTransport.fetch;
afterEach(() => {
  upstreamTransport.fetch = originalFetch;
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
  test("keeps the real page title when an upload dropzone renders its dialog first", () => {
    const page = parsePage(
      `<a href="logout.php">Logout</a>
      <div class="ui-dropzone ui-dropzone-wrapper">
        <dialog class="c-modal"><h1 class="modal-title">Dateien hochladen</h1></dialog>
        <div class="media il_HeaderInner">
          <h1 class="il-page-content-header media-heading ilHeader">Algorithms</h1>
        </div>
      </div>
      <h1 class="ilc_heading1">Dateien hochladen</h1>`,
      FREIBURG + "ilias.php?ref_id=12",
    );
    expect(page.title).toBe("Algorithms");
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
  test("reads search result paths while keeping hidden dialog items out", () => {
    const page = parsePage(
      `<a href="logout.php">Logout</a><h1>Search results</h1>
      <div class="il-item il-std-item">
        <span class="il-item-title"><a href="goto.php?target=grp_601">Gruppe 02</a></span>
        <div class="il-item-description">Exercise group</div>
        <span class="il-item-property-name">Path</span><span class="il-item-property-value">Introduction to Computer Science › Exercise groups</span>
        <span class="il-item-property-name">Created</span><span class="il-item-property-value">Yesterday</span>
      </div>
      <div class="il-item il-std-item">
        <span class="il-item-title"><a href="goto.php?target=grp_602">Gruppe 02</a></span>
        <span class="il-item-property-name">Path</span><span class="il-item-property-value">Linear Algebra I › Exercise groups</span>
      </div>
      <div role="dialog">
        <div class="il-item il-std-item">
          <span class="il-item-title"><a href="goto.php?target=grp_999">Hidden dialog item</a></span>
        </div>
      </div>`,
      FREIBURG + "ilias.php?baseClass=ilSearchController",
    );
    expect(
      page.items.map((item) => [item.id, item.type, item.title, item.context]),
    ).toEqual([
      [
        "601",
        "grp",
        "Gruppe 02",
        "Introduction to Computer Science › Exercise groups",
      ],
      ["602", "grp", "Gruppe 02", "Linear Algebra I › Exercise groups"],
    ]);
    expect(page.items[0].description).toBe("Exercise group");
    expect(page.items[0].meta).toBe("Created: Yesterday");
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
  test("keeps validated external web links as direct destinations", () => {
    const page = parsePage(
      `<a href="logout.php">Logout</a>
      <div class="ilContainerListItemOuter" id="lg_div_88">
        <img class="ilListItemIcon" src="./assets/icon_webr.svg">
        <h3 class="il_ContainerItemTitle">
          <a class="il_ContainerItemTitle" href="https://example.org/register" target="_blank">Register Your Github</a>
        </h3>
      </div>`,
      FREIBURG + "ilias.php?ref_id=12",
    );
    expect(page.items[0]).toMatchObject({
      id: "88",
      type: "webr",
      title: "Register Your Github",
      sourceUrl: "https://example.org/register",
      available: true,
    });
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
    const restricted = process.env.ACHILIAS_RESTRICT_INSTANCES;
    process.env.ACHILIAS_RESTRICT_INSTANCES = "true";
    try {
      expect(() => assertInstance("https://unconfigured.example/")).toThrow();
    } finally {
      if (restricted === undefined)
        delete process.env.ACHILIAS_RESTRICT_INSTANCES;
      else process.env.ACHILIAS_RESTRICT_INSTANCES = restricted;
    }
    expect(assertInstance("https://another-university.edu/ilias/")).toBe(
      "https://another-university.edu/ilias/",
    );
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
    upstreamTransport.fetch = mock(async (url: Parameters<typeof fetch>[0]) => {
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
    upstreamTransport.fetch = mock(
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
    upstreamTransport.fetch = mock(
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

test("origin checks allow local Host normalization and reject foreign mutations", () => {
  expect(() =>
    requireSameOrigin(
      new Request("http://localhost:3000/api/session", {
        headers: { origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" },
      }),
    ),
  ).not.toThrow();
  expect(() =>
    requireSameOrigin(
      new Request("http://localhost:3000/api/session", {
        headers: { origin: "https://other.example", host: "127.0.0.1:3000" },
      }),
    ),
  ).toThrow();
  expect(() =>
    requireSameOrigin(
      new Request("http://localhost:3000/api/session", {
        headers: {
          origin: "http://localhost:3000",
          "sec-fetch-site": "cross-site",
        },
      }),
    ),
  ).toThrow();
});

test("dashboard notification extraction excludes untriggered dialog templates while keeping visible warnings", () => {
  const html = `<a href="logout.php">Logout</a><h1>Dashboard</h1>
    <div class="alert">Real course notice</div>
    <div role="dialog"><div class="alert">Do you want to remove this item?</div></div>
    <template><div class="alert">Template confirmation</div></template>
    <div hidden><div class="alert">Hidden notification</div></div>
    <div aria-hidden="true"><div class="alert">Another hidden notification</div></div>
    <div style="display: none"><div class="alert">Hidden by inline style</div></div>`;
  expect(parsePage(html, FREIBURG).notices).toEqual(["Real course notice"]);
});
test("generic avatar labels are not interpreted as user names", () => {
  for (const label of ["Profilbild", "Avatar", "Profile picture"])
    expect(
      parsePage(
        `<div class="il-maincontrols-metabar"><img class="il-avatar" alt="${label}"></div>`,
        FREIBURG,
      ).userName,
    ).toBe("");
  expect(
    parsePage(
      '<div class="il-maincontrols-metabar"><img class="il-avatar" alt="Profilbild" title="Alex Example"></div>',
      FREIBURG,
    ).userName,
  ).toBe("Alex Example");
});
