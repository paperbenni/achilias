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
    expect(sent).toContain("PHPSESSID=ilias-session");
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
      parseCookieInput("not-a-cookie", FREIBURG),
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
