import { afterEach, describe, expect, mock, test } from "bun:test";
import { CookieJar } from "tough-cookie";
import {
  passwordLogin,
  PasswordLoginError,
} from "../src/lib/ilias/password-login";
import { upstreamTransport } from "../src/lib/ilias/upstream-transport";
import { FREIBURG } from "../src/lib/ilias/config";

const originalFetch = upstreamTransport.fetch;
afterEach(() => {
  upstreamTransport.fetch = originalFetch;
});

const html = (body: string, headers: Record<string, string> = {}) =>
  new Response(body, {
    headers: { "content-type": "text/html; charset=utf-8", ...headers },
  });
const redirect = (location: string, headers: Record<string, string> = {}) =>
  new Response(null, { status: 302, headers: { location, ...headers } });
const dashboard = () =>
  html(
    `<a href="logout.php">Logout</a>
     <h1 class="il-page-content-header">Dashboard</h1>
     <div class="il-maincontrols-metabar"><img class="il-avatar" alt="Alex Example"></div>`,
    { "set-cookie": "PHPSESSID=ilias-session; Path=/; Secure; HttpOnly" },
  );
const loginForm = `<!doctype html><html><body>
  <form id="login-form" method="post" action="https://mylogin.ub.uni-freiburg.de/authn/login?context=abc">
    <input type="hidden" name="LoginForm[context]" value="ctx">
    <input type="text" name="LoginForm[username]">
    <input type="password" name="LoginForm[password]">
    <input type="submit" name="yt0" value="Login">
  </form>
  <p>Hilfe zur Zwei-Faktor-Authentifizierung</p>
</body></html>`;

function mockTransport(
  handler: (
    url: string,
    init?: RequestInit,
  ) => Response | Promise<Response>,
) {
  upstreamTransport.fetch = mock(
    async (input: Parameters<typeof fetch>[0], init?: RequestInit) =>
      handler(String(input), init),
  ) as unknown as typeof fetch;
}

describe("password sign-in through myLogin", () => {
  test("submits the real form with all hidden fields and keeps only ILIAS cookies", async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    mockTransport((url, init) => {
      calls.push({
        url,
        method: init?.method || "GET",
        body: typeof init?.body === "string" ? init.body : undefined,
      });
      if (new URL(url).pathname === "/login.php")
        return html(`<a href="shib_login.php?target=">Login</a>`);
      if (url.includes("shib_login.php"))
        return redirect(
          "https://mylogin.ub.uni-freiburg.de/authn/login?context=abc",
        );
      if (url.startsWith("https://mylogin.ub.uni-freiburg.de/")) {
        if (init?.method === "POST")
          return redirect(FREIBURG + "ilias.php?baseClass=ilDashboardGUI", {
            "set-cookie": "PHPSESSID=ilias-session; Path=/; Secure; HttpOnly",
          });
        return html(loginForm);
      }
      if (url.startsWith(FREIBURG)) return dashboard();
      return new Response("not found", { status: 404 });
    });

    const result = await passwordLogin(FREIBURG, "alice", "s3cret");
    expect(result.userName).toBe("Alex Example");
    const jar = CookieJar.fromJSON(result.jar);
    expect(await jar?.getCookieString(FREIBURG)).toContain(
      "PHPSESSID=ilias-session",
    );
    const post = calls.find(
      (call) =>
        call.url.startsWith("https://mylogin.ub.uni-freiburg.de/") &&
        call.method === "POST",
    );
    expect(post).toBeDefined();
    const fields = new URLSearchParams(post!.body);
    expect(fields.get("LoginForm[context]")).toBe("ctx");
    expect(fields.get("LoginForm[username]")).toBe("alice");
    expect(fields.get("LoginForm[password]")).toBe("s3cret");
    expect(fields.get("yt0")).toBe("Login");
  });

  test("submits the IdP's hidden local-storage form before the login form", async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    mockTransport((url, init) => {
      calls.push({
        url,
        method: init?.method || "GET",
        body: typeof init?.body === "string" ? init.body : undefined,
      });
      const parsed = new URL(url);
      if (parsed.pathname === "/login.php")
        return html(`<a href="shib_login.php?target=">Login</a>`);
      if (parsed.pathname === "/shib_login.php")
        return redirect(
          "https://mylogin.ub.uni-freiburg.de/idp/profile/SAML2/Redirect/SSO?SAMLRequest=abc&RelayState=xyz",
        );
      if (
        parsed.hostname === "mylogin.ub.uni-freiburg.de" &&
        parsed.pathname === "/idp/profile/SAML2/Redirect/SSO" &&
        parsed.searchParams.has("SAMLRequest")
      )
        return html(`<form name="form1" action="/idp/profile/SAML2/Redirect/SSO?execution=e1s1" method="post">
          <input type="hidden" name="csrf_token" value="csrf">
          <input type="hidden" name="shib_idp_ls_exception.shib_idp_session_ss">
          <input type="hidden" name="shib_idp_ls_success.shib_idp_session_ss" value="false">
          <input type="hidden" name="shib_idp_ls_value.shib_idp_session_ss">
          <input type="hidden" name="shib_idp_ls_supported">
          <input type="hidden" name="_eventId_proceed">
        </form>`);
      if (
        parsed.hostname === "mylogin.ub.uni-freiburg.de" &&
        parsed.pathname === "/idp/profile/SAML2/Redirect/SSO" &&
        parsed.searchParams.get("execution") === "e1s1"
      )
        return redirect(
          "https://mylogin.ub.uni-freiburg.de/authn/login?context=abc",
        );
      if (
        parsed.hostname === "mylogin.ub.uni-freiburg.de" &&
        parsed.pathname === "/authn/login"
      ) {
        if (init?.method === "POST")
          return redirect(FREIBURG + "ilias.php?baseClass=ilDashboardGUI", {
            "set-cookie": "PHPSESSID=ilias-session; Path=/; Secure; HttpOnly",
          });
        return html(loginForm);
      }
      if (url.startsWith(FREIBURG)) return dashboard();
      return new Response("not found", { status: 404 });
    });

    const result = await passwordLogin(FREIBURG, "alice", "s3cret");
    expect(result.userName).toBe("Alex Example");
    const hidden = calls.find(
      (call) =>
        call.url.includes("SAML2/Redirect/SSO?execution=e1s1") &&
        call.method === "POST",
    );
    expect(hidden).toBeDefined();
    const fields = new URLSearchParams(hidden!.body);
    expect(fields.get("csrf_token")).toBe("csrf");
    expect(fields.get("shib_idp_ls_success.shib_idp_session_ss")).toBe("false");
    expect(fields.get("_eventId_proceed")).toBe("");
  });

  test("prefers the university SSO link over a local ILIAS password form", async () => {
    const posted: string[] = [];
    mockTransport((url, init) => {
      if (init?.method === "POST") posted.push(url);
      if (new URL(url).pathname === "/login.php")
        return html(`<form method="post" action="login.php">
            <input type="text" name="username">
            <input type="password" name="password">
          </form>
          <a href="shib_login.php?target=">myLogin</a>`);
      if (url.includes("shib_login.php"))
        return redirect(
          "https://mylogin.ub.uni-freiburg.de/authn/login?context=abc",
        );
      if (url.startsWith("https://mylogin.ub.uni-freiburg.de/")) {
        if (init?.method === "POST")
          return redirect(FREIBURG + "ilias.php?baseClass=ilDashboardGUI", {
            "set-cookie": "PHPSESSID=ilias-session; Path=/; Secure; HttpOnly",
          });
        return html(loginForm);
      }
      if (url.startsWith(FREIBURG)) return dashboard();
      return new Response("not found", { status: 404 });
    });

    await passwordLogin(FREIBURG, "alice", "s3cret");
    expect(posted).toHaveLength(1);
    expect(posted[0].startsWith("https://mylogin.ub.uni-freiburg.de/")).toBe(
      true,
    );
  });

  test("reports rejected credentials without leaking the form", async () => {
    mockTransport((url, init) => {
      if (new URL(url).pathname === "/login.php")
        return html(`<a href="shib_login.php?target=">Login</a>`);
      if (url.includes("shib_login.php"))
        return redirect(
          "https://mylogin.ub.uni-freiburg.de/authn/login?context=abc",
        );
      if (url.startsWith("https://mylogin.ub.uni-freiburg.de/"))
        return init?.method === "POST"
          ? html(
              `<p class="error">Benutzername oder Passwort falsch</p>${loginForm}`,
            )
          : html(loginForm);
      return new Response("not found", { status: 404 });
    });

    await expect(passwordLogin(FREIBURG, "alice", "wrong")).rejects.toMatchObject(
      {
        status: 401,
        message: "The university login rejected the username or password.",
      },
    );
  });

  test("does not try to complete a second factor", async () => {
    mockTransport((url, init) => {
      if (new URL(url).pathname === "/login.php")
        return html(`<a href="shib_login.php?target=">Login</a>`);
      if (url.includes("shib_login.php"))
        return redirect(
          "https://mylogin.ub.uni-freiburg.de/authn/login?context=abc",
        );
      if (url.startsWith("https://mylogin.ub.uni-freiburg.de/"))
        return init?.method === "POST"
          ? html(
              `<input autocomplete="one-time-code" name="otp">${loginForm}`,
            )
          : html(loginForm);
      return new Response("not found", { status: 404 });
    });

    await expect(passwordLogin(FREIBURG, "alice", "s3cret")).rejects.toMatchObject(
      { status: 409 },
    );
  });

  test("refuses to post credentials to a different origin", async () => {
    let posted = false;
    mockTransport((url, init) => {
      if (new URL(url).pathname === "/login.php")
        return html(`<a href="shib_login.php?target=">Login</a>`);
      if (url.includes("shib_login.php"))
        return redirect(
          "https://mylogin.ub.uni-freiburg.de/authn/login?context=abc",
        );
      if (url.startsWith("https://mylogin.ub.uni-freiburg.de/")) {
        if (init?.method === "POST") posted = true;
        return html(
          loginForm.replace(
            "https://mylogin.ub.uni-freiburg.de/authn/login?context=abc",
            "https://evil.example/login",
          ),
        );
      }
      return new Response("not found", { status: 404 });
    });

    await expect(passwordLogin(FREIBURG, "alice", "s3cret")).rejects.toBeInstanceOf(
      PasswordLoginError,
    );
    expect(posted).toBe(false);
  });

  test("follows a SAML auto-submit form back to ILIAS", async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    mockTransport((url, init) => {
      calls.push({
        url,
        method: init?.method || "GET",
        body: typeof init?.body === "string" ? init.body : undefined,
      });
      if (new URL(url).pathname === "/login.php")
        return html(`<a href="shib_login.php?target=">Login</a>`);
      if (url.includes("shib_login.php"))
        return redirect(
          "https://mylogin.ub.uni-freiburg.de/authn/login?context=abc",
        );
      if (url.startsWith("https://mylogin.ub.uni-freiburg.de/")) {
        if (init?.method === "POST")
          return html(`<form method="post" action="https://ilias.uni-freiburg.de/Shibboleth.sso/SAML2/POST">
            <input type="hidden" name="SAMLResponse" value="saml-response">
            <input type="hidden" name="RelayState" value="relay">
          </form>`);
        return html(loginForm);
      }
      if (url.includes("Shibboleth.sso/SAML2/POST"))
        return redirect(FREIBURG + "ilias.php?baseClass=ilDashboardGUI", {
          "set-cookie": "PHPSESSID=ilias-session; Path=/; Secure; HttpOnly",
        });
      if (url.startsWith(FREIBURG)) return dashboard();
      return new Response("not found", { status: 404 });
    });

    const result = await passwordLogin(FREIBURG, "alice", "s3cret");
    expect(result.userName).toBe("Alex Example");
    const saml = calls.find((call) =>
      call.url.includes("Shibboleth.sso/SAML2/POST"),
    );
    expect(saml?.method).toBe("POST");
    expect(new URLSearchParams(saml!.body).get("SAMLResponse")).toBe(
      "saml-response",
    );
  });
});
