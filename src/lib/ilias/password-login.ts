import { load, type CheerioAPI } from "cheerio";
import { CookieJar } from "tough-cookie";
import { dashboardUrl, loginUrl } from "./config";
import { upstreamTransport } from "./upstream-transport";
import { importInstanceCookies } from "./cookie-import";
import { fetchPage } from "./client";
import { formFields } from "./html-forms";
import { parsePage } from "./parser";
import { readBoundedText } from "./bounded-read";
import type { Session } from "./session";

type Selection = ReturnType<CheerioAPI>;
type Page = { url: URL; html: string; $: CheerioAPI };

const userAgent =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Achilias/0.1";
const maxHtml = 4 * 1024 * 1024;
const maxHops = 12;

export class PasswordLoginError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

async function request(
  jar: CookieJar,
  url: URL,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("User-Agent", userAgent);
  headers.set(
    "Accept",
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  );
  headers.set("Accept-Language", "de-DE,de;q=0.9,en;q=0.8");
  const cookie = await jar.getCookieString(url.href);
  if (cookie) headers.set("Cookie", cookie);
  let response: Response;
  try {
    response = await upstreamTransport.fetch(url, {
      ...init,
      headers,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new PasswordLoginError(
      "The university sign-in page could not be reached. Check the instance address and try again.",
      502,
    );
  }
  for (const value of response.headers.getSetCookie())
    await jar.setCookie(value, url.href, { ignoreError: true });
  return response;
}

function metaRefresh(page: Page) {
  const content =
    page.$('meta[http-equiv="refresh" i]').attr("content") ||
    page.$('meta[http-equiv="Refresh"]').attr("content") ||
    "";
  const match = /url\s*=\s*(.+)$/i.exec(content);
  if (!match) return null;
  try {
    return new URL(match[1].trim().replace(/^['"]|['"]$/g, ""), page.url);
  } catch {
    return null;
  }
}

async function send(
  jar: CookieJar,
  start: URL,
  options: { form?: URLSearchParams; referer?: URL } = {},
): Promise<Page> {
  let url = start;
  let form = options.form;
  let referer = options.referer;
  for (let hop = 0; hop < maxHops; hop++) {
    const response = await request(jar, url, {
      method: form ? "POST" : "GET",
      ...(form
        ? {
            body: form.toString(),
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              ...(referer
                ? { Origin: referer.origin, Referer: referer.href }
                : {}),
            },
          }
        : {}),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location)
        throw new PasswordLoginError(
          "The university login returned an incomplete redirect.",
          502,
        );
      const next = new URL(location, url);
      if (form && [301, 302, 303].includes(response.status)) form = undefined;
      if (form && next.origin !== url.origin)
        throw new PasswordLoginError(
          "The university login tried to send your password to another site.",
          422,
        );
      referer = url;
      url = next;
      continue;
    }
    if (response.status === 429) {
      await response.body?.cancel();
      throw new PasswordLoginError(
        "The university login is rate-limiting attempts. Wait and try again.",
        429,
      );
    }
    if (response.status === 401 || response.status === 403) {
      await response.body?.cancel();
      throw new PasswordLoginError(
        "The university login rejected the sign-in.",
        401,
      );
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new PasswordLoginError(
        `The university login returned an error (${response.status}).`,
        502,
      );
    }
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("html") && !contentType.includes("xml")) {
      await response.body?.cancel();
      throw new PasswordLoginError(
        "The university login returned an unexpected response.",
        502,
      );
    }
    let html: string;
    try {
      html = await readBoundedText(response.body, maxHtml);
    } catch {
      throw new PasswordLoginError(
        "The university login page is too large to process.",
        502,
      );
    }
    const page: Page = { url, html, $: load(html) };
    const refresh = metaRefresh(page);
    if (refresh) {
      referer = url;
      url = refresh;
      continue;
    }
    return page;
  }
  throw new PasswordLoginError(
    "The university login redirected too many times.",
    502,
  );
}

function findLoginForm($: CheerioAPI): Selection | null {
  const password = $('input[type="password"][name]').first();
  if (!password.length) return null;
  const form = password.closest("form");
  if (form.length) return form;
  const fallback = $("form")
    .filter((_, el) => $(el).find('input[type="password"]').length > 0)
    .first();
  return fallback.length ? fallback : null;
}

function chooseLoginLink($: CheerioAPI, base: URL) {
  const hrefs = $("a[href]")
    .toArray()
    .map((el) => $(el).attr("href") || "");
  const candidates = [
    hrefs.find((href) => /shib_login\.php/i.test(href)),
    hrefs.find((href) => /openidconnect\.php/i.test(href)),
  ].filter(Boolean) as string[];
  for (const href of candidates) {
    try {
      return new URL(href, base);
    } catch {
      /* Try the next candidate. */
    }
  }
  return null;
}

function usernameField($: CheerioAPI, form: Selection) {
  const candidates = form
    .find("input[name]")
    .toArray()
    .filter((el) => {
      const type = ($(el).attr("type") || "text").toLowerCase();
      return ["text", "email", "tel"].includes(type);
    });
  const named = candidates.find((el) => {
    const input = $(el);
    return /user|login|kennung|email|account/i.test(
      `${input.attr("name")} ${input.attr("id")} ${input.attr("autocomplete")}`,
    );
  });
  const chosen = named || candidates[0];
  return chosen ? $(chosen).attr("name") || null : null;
}

function hasSecondFactorField($: CheerioAPI) {
  return $("input")
    .toArray()
    .some((el) => {
      const input = $(el);
      if ((input.attr("type") || "").toLowerCase() === "hidden") return false;
      return /otp|totp|one-?time|mfa/i.test(
        `${input.attr("name") || ""} ${input.attr("autocomplete") || ""}`,
      );
    });
}

/** Only read help text when no password form remains after a submission. */
function secondFactorMessage($: CheerioAPI) {
  return /(?:zwei|2)[- ]?faktor|bestätigungscode|verification code|authenticator|einmalpasswort/i.test(
    $("body").text(),
  );
}

function findAutoForm($: CheerioAPI, base: URL) {
  for (const el of $("form").toArray()) {
    const form = $(el);
    const action = form.attr("action");
    if (!action) continue;
    let url: URL;
    try {
      url = new URL(action, base);
    } catch {
      continue;
    }
    const saml = form.find('input[name="SAMLResponse"], input[name="RelayState"]');
    if (saml.length || /saml|shibboleth/i.test(url.pathname))
      return { form, url };
  }
  return null;
}

/**
 * Sign in through the university's real password form. Credentials are used
 * only for this request and never saved; only ILIAS cookies leave this module.
 * Only use on a single-user deployment you control.
 */
export async function passwordLogin(
  instance: string,
  username: string,
  password: string,
) {
  const instanceHost = new URL(instance).hostname;
  const jar = new CookieJar();
  let page = await send(jar, new URL(loginUrl(instance)));

  let submitted = false;
  let autoSubmitted = false;
  for (let step = 0; step < 8; step++) {
    if (page.url.hostname === instanceHost) {
      const parsed = parsePage(page.html, page.url.href);
      if (parsed.authenticated) {
        const cookies = (await jar.getCookies(instance)).map((cookie) => ({
          name: cookie.key,
          value: cookie.value,
          domain: cookie.domain || instanceHost,
          path: cookie.path || "/",
          secure: Boolean(cookie.secure),
          httpOnly: Boolean(cookie.httpOnly),
          ...(cookie.expires instanceof Date
            ? { expires: Math.floor(cookie.expires.getTime() / 1000) }
            : {}),
        }));
        const sessionJar = await importInstanceCookies(cookies, instance);
        const candidate: Session = {
          id: "password-login",
          instance,
          status: "pending",
          createdAt: Date.now(),
          jar: sessionJar,
        };
        let dashboard;
        try {
          dashboard = await fetchPage(candidate, dashboardUrl(instance));
        } catch {
          throw new PasswordLoginError(
            "The university sign-in succeeded, but Achilias could not verify the session from this server. Try again.",
            422,
          );
        }
        return {
          jar: candidate.jar!,
          userName: dashboard.userName || parsed.userName,
          iliasVersion: dashboard.iliasVersion || parsed.iliasVersion,
        };
      }
    }
    // Prefer the university's SSO link over any local ILIAS account form that
    // may share the login page. Only follow it while still on the instance.
    if (!submitted && page.url.hostname === instanceHost) {
      const link = chooseLoginLink(page.$, page.url);
      if (link) {
        page = await send(jar, link);
        continue;
      }
    }
    if (hasSecondFactorField(page.$))
      throw new PasswordLoginError(
        "This university account requires a second factor, which password sign-in cannot complete. Use the browser helper instead.",
        409,
      );
    const form = findLoginForm(page.$);
    if (!form && submitted && secondFactorMessage(page.$))
      throw new PasswordLoginError(
        "This university account requires a second factor, which password sign-in cannot complete. Use the browser helper instead.",
        409,
      );
    if (form) {
      if (submitted)
        throw new PasswordLoginError(
          "The university login rejected the username or password.",
          401,
        );
      const action = new URL(form.attr("action") || page.url.href, page.url);
      if (action.origin !== page.url.origin)
        throw new PasswordLoginError(
          "The university login form points to an unexpected site.",
          422,
        );
      const user = usernameField(page.$, form);
      const pass = form.find('input[type="password"][name]').first().attr("name");
      if (!user || !pass)
        throw new PasswordLoginError(
          "The university login form did not offer username and password fields.",
          422,
        );
      const data = new URLSearchParams(
        formFields(page.$, form, { submitter: true }),
      );
      data.set(user, username);
      data.set(pass, password);
      page = await send(jar, action, { form: data, referer: page.url });
      submitted = true;
      continue;
    }
    const auto = findAutoForm(page.$, page.url);
    if (auto) {
      if (
        auto.url.hostname !== instanceHost &&
        auto.url.origin !== page.url.origin
      )
        throw new PasswordLoginError(
          "The university login tried to send the session to an unexpected site.",
          422,
        );
      page = await send(jar, auto.url, {
        form: new URLSearchParams(
          formFields(page.$, auto.form, { submitter: true }),
        ),
        referer: page.url,
      });
      autoSubmitted = true;
      continue;
    }
    if (submitted || autoSubmitted)
      throw new PasswordLoginError(
        "The university login did not return to ILIAS. Try again or use the browser helper.",
        422,
      );
    throw new PasswordLoginError(
      "The university login page did not offer a password form. Use the browser helper instead.",
      422,
    );
  }
  throw new PasswordLoginError(
    "The university login took too many steps. Try again or use the browser helper.",
    502,
  );
}
