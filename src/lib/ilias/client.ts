import { upstreamTransport } from "./upstream-transport";
import { CookieJar } from "tough-cookie";
import { upstreamUrl } from "./config";
import {
  readSession,
  saveSession,
  withSessionLock,
  type Session,
} from "./session";
import { parsePage } from "./parser";
import { IliasError } from "./errors";
import { requireLiveWrite } from "./write-policy";
export { IliasError } from "./errors";
export async function fetchUpstream(
  session: Session,
  target: string,
  options: { file?: boolean; form?: URLSearchParams } = {},
) {
  if (options.form) {
    const action = upstreamUrl(session.instance, target);
    const id = action.searchParams.get("ref_id") || "";
    requireLiveWrite(session.instance, "exc", id);
  }
  let form = options.form;
  const jar = session.jar ? CookieJar.fromJSON(session.jar) : new CookieJar();
  const rotations: { cookie: string; url: string }[] = [];
  let url = upstreamUrl(session.instance, target);
  for (let redirect = 0; redirect < 10; redirect++) {
    let response: Response;
    try {
      response = await upstreamTransport.fetch(url, {
        redirect: "manual",
        cache: "no-store",
        method: form ? "POST" : "GET",
        ...(form ? { body: form.toString() } : {}),
        headers: {
          Cookie: await jar.getCookieString(url.href),
          "User-Agent": "Achilias/0.1 (personal ILIAS frontend)",
          Accept: options.file ? "*/*" : "text/html",
          ...(form
            ? {
                "Content-Type": "application/x-www-form-urlencoded",
                Origin: new URL(session.instance).origin,
                Referer: url.href,
              }
            : {}),
        },
        signal: AbortSignal.timeout(25_000),
      });
    } catch {
      throw new IliasError(
        options.form
          ? "The ILIAS request did not finish. Changes may already have been saved; check ILIAS before retrying."
          : "ILIAS could not be reached. Check your connection and try again.",
      );
    }
    for (const cookie of response.headers.getSetCookie()) {
      await jar.setCookie(cookie, url.href, { ignoreError: true });
      rotations.push({ cookie, url: url.href });
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (form && [307, 308].includes(response.status)) {
        await response.body?.cancel();
        throw new IliasError(
          "ILIAS requested a repeated POST. Achilias did not replay it. Changes may already have been saved; check the original before retrying.",
          409,
        );
      }
      const location = response.headers.get("location");
      if ([301, 302, 303].includes(response.status)) form = undefined;
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
    if (session.status === "connected" && rotations.length)
      await withSessionLock(session.id, async () => {
        const current = await readSession(session.id);
        if (current?.status !== "connected") return;
        // Merge only this response's changes into the latest jar. Concurrent
        // requests must not overwrite each other's cookies or resurrect logout.
        const latest = current.jar
          ? CookieJar.fromJSON(current.jar)
          : new CookieJar();
        for (const { cookie, url } of rotations)
          await latest.setCookie(cookie, url, { ignoreError: true });
        current.jar = latest.serializeSync();
        await saveSession(current);
        session.jar = current.jar;
      });
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
  const html = await readUpstreamText(response);
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

/** Limit decompressed text before parsing untrusted, user-selected instances. */
export async function readUpstreamText(
  response: Response,
  limit = 8 * 1024 * 1024,
) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new IliasError(
          "The ILIAS page is too large to parse safely. Open the original page.",
          502,
        );
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}
