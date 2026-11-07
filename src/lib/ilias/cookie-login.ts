import { dashboardUrl } from "./config";
import { importInstanceCookies } from "./cookie-import";
import { fetchPage } from "./client";
import type { Session } from "./session";

export class CookieLoginError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export const maxCookieInput = 64 * 1024;

const attributes = new Set([
  "path",
  "domain",
  "expires",
  "max-age",
  "samesite",
  "secure",
  "httponly",
]);
const sessionCookieName = "PHPSESSID";
const knownCookieNames = new Set(["phpsessid", "ilclientid"]);
const cookiePair = /^[A-Za-z0-9!#$%&'*+\-.^_`|~]+=[^=;\s]+$/;
const cookieName = /^([A-Za-z0-9!#$%&'*+\-.^_`|~]+)=/;

function rawCookieValues(input: string, hostname: string) {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*cookie\s*:\s*/i, "").trim())
    .filter(Boolean);
  // A single opaque value is treated as the PHP session cookie. This lets
  // users paste the value from DevTools without the cookie name.
  if (lines.length === 1) {
    const value = lines[0].replace(/^(['"])(.*)\1$/, "$2").trim();
    const name = cookieName.exec(value)?.[1].toLowerCase();
    const knownPair = name ? knownCookieNames.has(name) : false;
    if (
      value &&
      !attributes.has(value.toLowerCase()) &&
      !knownPair &&
      !cookiePair.test(value) &&
      !/[;\s]/.test(value)
    )
      return [
        {
          name: sessionCookieName,
          value,
          domain: hostname,
          path: "/",
          secure: true,
          httpOnly: true,
        },
      ];
  }
  const cookies: {
    name: string;
    value: string;
    domain: string;
    path: string;
    secure: boolean;
    httpOnly: boolean;
  }[] = [];
  for (const header of lines) {
    for (const part of header.split(";")) {
      const item = part.trim();
      if (!item) continue;
      const separator = item.indexOf("=");
      if (separator < 0) {
        if (attributes.has(item.toLowerCase())) continue;
        throw new CookieLoginError(
          "Cookie entries must use name=value or a session value.",
        );
      }
      if (separator === 0)
        throw new CookieLoginError(
          "Cookie entries must use name=value or a session value.",
        );
      const name = item.slice(0, separator).trim();
      const value = item.slice(separator + 1).trim();
      if (!name || !value)
        throw new CookieLoginError(
          "Cookie entries must use a non-empty name and value.",
        );
      if (attributes.has(name.toLowerCase())) continue;
      cookies.push({
        name,
        value,
        domain: hostname,
        path: "/",
        secure: true,
        httpOnly: true,
      });
    }
  }
  if (!cookies.length)
    throw new CookieLoginError(
      "Paste a Cookie header, a session value, or a cookie JSON export.",
    );
  return cookies;
}

/**
 * Accept a browser `Cookie` header (also with the header name), a bare
 * session value, or a Playwright storageState/cookie array. All are reduced to
 * exact-instance cookies before the server verifies the session.
 */
export async function parseCookieInput(input: string, instance: string) {
  if (input.length > maxCookieInput)
    throw new CookieLoginError("Cookie input is too large.", 413);
  const text = input.trim();
  if (!text)
    throw new CookieLoginError(
      "Paste a Cookie header, a session value, or a cookie JSON export.",
    );
  let data: unknown;
  if (text.startsWith("[") || text.startsWith("{")) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new CookieLoginError("Cookie JSON is not valid.");
    }
  } else {
    data = rawCookieValues(text, new URL(instance).hostname);
  }
  try {
    const jar = await importInstanceCookies(data, instance);
    if (!jar) throw new CookieLoginError("Cookie data is empty.");
    return jar;
  } catch (error) {
    if (error instanceof CookieLoginError) throw error;
    throw new CookieLoginError(
      error instanceof Error ? error.message : "Invalid cookie data.",
    );
  }
}

/** Validate imported cookies against the live dashboard before connecting. */
export async function cookieLogin(instance: string, input: string) {
  const jar = await parseCookieInput(input, instance);
  const candidate: Session = {
    id: "cookie-login",
    instance,
    status: "pending",
    createdAt: Date.now(),
    jar,
  };
  let page;
  try {
    page = await fetchPage(candidate, dashboardUrl(instance));
  } catch {
    throw new CookieLoginError(
      "The server could not verify this ILIAS session. It may have expired or be tied to your login IP. Sign in again and copy fresh cookies.",
      422,
    );
  }
  return { jar: candidate.jar!, userName: page.userName };
}
