import { CookieJar } from "tough-cookie";
import { upstreamUrl } from "./config";
import { saveSession, type Session } from "./session";
import { parsePage } from "./parser";
export class IliasError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}
export async function fetchUpstream(
  session: Session,
  target: string,
  file = false,
) {
  const jar = session.jar ? CookieJar.fromJSON(session.jar) : new CookieJar();
  let url = upstreamUrl(session.instance, target);
  for (let redirect = 0; redirect < 10; redirect++) {
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        cache: "no-store",
        headers: {
          Cookie: await jar.getCookieString(url.href),
          "User-Agent": "Achilias/0.1 (personal ILIAS frontend)",
          Accept: file ? "*/*" : "text/html",
        },
        signal: AbortSignal.timeout(25_000),
      });
    } catch {
      throw new IliasError(
        "ILIAS could not be reached. Check your connection and try again.",
      );
    }
    for (const cookie of response.headers.getSetCookie())
      await jar.setCookie(cookie, url.href, { ignoreError: true });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location)
        throw new IliasError("ILIAS returned an incomplete redirect.");
      try {
        url = upstreamUrl(session.instance, new URL(location, url).href);
      } catch {
        throw new IliasError(
          "Your ILIAS session needs a fresh university sign-in. Reconnect your account.",
          401,
        );
      }
      if (/\/(?:login|shib_login)\.php$/i.test(url.pathname))
        throw new IliasError(
          "Your ILIAS session has expired. Reconnect your account.",
          401,
        );
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new IliasError(
        response.status === 403
          ? "ILIAS has not granted access to this content."
          : `ILIAS returned an error (${response.status}).`,
        response.status === 403 ? 403 : 502,
      );
    }
    session.jar = jar.serializeSync();
    // Only persist a previously created session; tests/public probes need no disk state.
    if (session.status === "connected") await saveSession(session);
    return { response, url: url.href };
  }
  throw new IliasError(
    "ILIAS redirected too many times. Reconnect your account.",
  );
}
export async function fetchAuthenticatedHtml(session: Session, target: string) {
  const { response, url } = await fetchUpstream(session, target);
  if (!(response.headers.get("content-type") || "").includes("text/html")) {
    await response.body?.cancel();
    throw new IliasError(
      "This object is not a content listing. Open it in ILIAS.",
    );
  }
  const html = await response.text();
  const page = parsePage(html, url);
  if (!page.authenticated)
    throw new IliasError(
      "Your ILIAS session has expired, or ILIAS requires an additional step. Reconnect to continue.",
      401,
    );
  return { html, url, page };
}
export async function fetchPage(session: Session, target: string) {
  return (await fetchAuthenticatedHtml(session, target)).page;
}
