import { afterEach, describe, expect, mock, test } from "bun:test";
import { CookieJar } from "tough-cookie";
import {
  cookieLogin,
  parseCookieInput,
  CookieLoginError,
} from "../src/lib/ilias/cookie-login";
import { upstreamTransport } from "../src/lib/ilias/upstream-transport";
import { FREIBURG } from "../src/lib/ilias/config";

const originalFetch = upstreamTransport.fetch;
afterEach(() => {
  upstreamTransport.fetch = originalFetch;
});

const dashboard = () =>
  new Response(
    `<a href="logout.php">Logout</a>
     <h1 class="il-page-content-header">Dashboard</h1>
     <footer>powered by ILIAS (v11.0)</footer>
     <div class="il-maincontrols-metabar"><img class="il-avatar" alt="Alex Example"></div>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );

describe("cookie sign-in", () => {
  test("accepts a Cookie header and verifies the dashboard", async () => {
    let sent = "";
    upstreamTransport.fetch = mock(
      async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        sent = (init?.headers as Record<string, string>).Cookie || "";
        return dashboard();
      },
    ) as unknown as typeof fetch;

    const result = await cookieLogin(
      FREIBURG,
      "Cookie: PHPSESSID=ilias-session; path=/",
    );
    expect(result.userName).toBe("Alex Example");
    expect(result.iliasVersion).toBe("11.0");
    expect(sent).toContain("PHPSESSID=ilias-session");
  });

  test("accepts a bare session value as PHPSESSID and verifies it", async () => {
    let sent = "";
    upstreamTransport.fetch = mock(
      async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        sent = (init?.headers as Record<string, string>).Cookie || "";
        return dashboard();
      },
    ) as unknown as typeof fetch;

    const result = await cookieLogin(FREIBURG, "bare-session-value");
    expect(result.userName).toBe("Alex Example");
    expect(sent).toContain("PHPSESSID=bare-session-value");
  });

  test("treats a single opaque padded token as a session value", async () => {
    const jar = await parseCookieInput("opaque-token==", FREIBURG);
    expect(
      await CookieJar.fromJSON(jar)!.getCookieString(FREIBURG),
    ).toContain("PHPSESSID=opaque-token==");
  });

  test("keeps a full PHPSESSID pair with a padded value", async () => {
    const jar = await parseCookieInput("PHPSESSID=opaque-token==", FREIBURG);
    expect(
      await CookieJar.fromJSON(jar)!.getCookieString(FREIBURG),
    ).toContain("PHPSESSID=opaque-token==");
  });

  test("accepts a quoted bare session value", async () => {
    const jar = await parseCookieInput('"quoted-session-value"', FREIBURG);
    expect(
      await CookieJar.fromJSON(jar)!.getCookieString(FREIBURG),
    ).toContain("PHPSESSID=quoted-session-value");
  });

  test("accepts a Cookie: prefix around a bare session value", async () => {
    const jar = await parseCookieInput(
      "Cookie: bare-session-value",
      FREIBURG,
    );
    expect(
      await CookieJar.fromJSON(jar)!.getCookieString(FREIBURG),
    ).toContain("PHPSESSID=bare-session-value");
  });

  test("accepts a JSON cookie export and drops non-ILIAS cookies", async () => {
    const jar = await parseCookieInput(
      JSON.stringify([
        {
          name: "PHPSESSID",
          value: "from-json",
          domain: "ilias.uni-freiburg.de",
          path: "/",
        },
        {
          name: "SSO",
          value: "identity-provider-secret",
          domain: ".uni-freiburg.de",
          path: "/",
        },
      ]),
      FREIBURG,
    );
    const serialized = JSON.stringify(jar);
    expect(serialized).toContain("PHPSESSID");
    expect(serialized).not.toContain("identity-provider-secret");
  });

  test("rejects empty or malformed input and unverifiable cookies", async () => {
    await expect(parseCookieInput("", FREIBURG)).rejects.toBeInstanceOf(
      CookieLoginError,
    );
    await expect(
      parseCookieInput("not a cookie", FREIBURG),
    ).rejects.toBeInstanceOf(CookieLoginError);
    await expect(
      parseCookieInput(
        JSON.stringify([
          {
            name: "PHPSESSID",
            value: "other-host",
            domain: "other.example",
            path: "/",
          },
        ]),
        FREIBURG,
      ),
    ).rejects.toBeInstanceOf(CookieLoginError);

    upstreamTransport.fetch = mock(
      async () =>
        new Response("<h1>Login</h1>", {
          headers: { "content-type": "text/html" },
        }),
    ) as unknown as typeof fetch;
    await expect(
      cookieLogin(FREIBURG, "PHPSESSID=expired"),
    ).rejects.toMatchObject({ status: 422 });
  });

  test("imports only the exact ILIAS host", async () => {
    const jar = await parseCookieInput("PHPSESSID=only-ilias", FREIBURG);
    expect(
      await CookieJar.fromJSON(jar)!.getCookieString(FREIBURG),
    ).toContain("PHPSESSID=only-ilias");
  });
});
